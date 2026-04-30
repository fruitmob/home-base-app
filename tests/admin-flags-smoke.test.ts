import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  GET as listFlagsRoute,
  POST as createFlagRoute,
} from "@/app/api/admin/flags/route";
import {
  PATCH as updateFlagRoute,
  DELETE as deleteFlagRoute,
} from "@/app/api/admin/flags/[id]/route";
import { Role } from "@/generated/prisma/client";
import { checkFlag, loadFlagMap } from "@/lib/flags";
import { db } from "@/lib/db";

const csrfToken = "flags-smoke-csrf";

type TestSession = {
  userId: string;
  sessionId: string;
};

async function main() {
  const suffix = randomUUID().slice(0, 8);
  const sessions: TestSession[] = [];
  const createdFlagIds: string[] = [];

  try {
    const owner = await createTestSession(Role.OWNER, `flag-owner-${suffix}`);
    const admin = await createTestSession(Role.ADMIN, `flag-admin-${suffix}`);
    const viewer = await createTestSession(Role.VIEWER, `flag-viewer-${suffix}`);
    sessions.push(owner, admin, viewer);

    const flagKey = `test.flag.${suffix}`;

    // Viewer cannot create
    const viewerCreateResponse = await createFlagRoute(
      jsonRequest("http://homebase.local/api/admin/flags", "POST", viewer.sessionId, {
        key: flagKey,
        label: "Test Flag",
      }),
    );
    assert.equal(viewerCreateResponse.status, 403, "viewer cannot create flag");

    // Admin cannot create (owner-only)
    const adminCreateResponse = await createFlagRoute(
      jsonRequest("http://homebase.local/api/admin/flags", "POST", admin.sessionId, {
        key: flagKey,
        label: "Test Flag",
      }),
    );
    assert.equal(adminCreateResponse.status, 403, "admin cannot create flag");

    // Owner can create
    const createResponse = await createFlagRoute(
      jsonRequest("http://homebase.local/api/admin/flags", "POST", owner.sessionId, {
        key: flagKey,
        label: "Test Flag Label",
        description: "Created by smoke test",
        enabled: false,
      }),
    );
    assert.equal(createResponse.status, 201, "owner can create flag");
    const createBody = (await createResponse.json()) as { flag: { id: string; key: string; enabled: boolean } };
    const flagId = createBody.flag.id;
    createdFlagIds.push(flagId);
    assert.equal(createBody.flag.key, flagKey);
    assert.equal(createBody.flag.enabled, false);

    // Duplicate key is rejected
    const dupResponse = await createFlagRoute(
      jsonRequest("http://homebase.local/api/admin/flags", "POST", owner.sessionId, {
        key: flagKey,
        label: "Duplicate",
      }),
    );
    assert.equal(dupResponse.status, 409, "duplicate flag key rejected");

    // Admin can list
    const listResponse = await listFlagsRoute(
      authedRequest("http://homebase.local/api/admin/flags", "GET", admin.sessionId),
    );
    assert.equal(listResponse.status, 200, "admin can list flags");
    const listBody = (await listResponse.json()) as { flags: Array<{ id: string }> };
    assert.ok(
      listBody.flags.some((f) => f.id === flagId),
      "created flag appears in list",
    );

    // Viewer cannot list
    const viewerListResponse = await listFlagsRoute(
      authedRequest("http://homebase.local/api/admin/flags", "GET", viewer.sessionId),
    );
    assert.equal(viewerListResponse.status, 403, "viewer cannot list flags");

    // checkFlag returns false when flag is disabled
    const flagOffValue = await checkFlag(flagKey);
    assert.equal(flagOffValue, false, "checkFlag returns false for disabled flag");

    // Enable the flag
    const enableResponse = await updateFlagRoute(
      jsonRequest(`http://homebase.local/api/admin/flags/${flagId}`, "PATCH", owner.sessionId, {
        enabled: true,
      }),
      { params: { id: flagId } },
    );
    assert.equal(enableResponse.status, 200, "owner can enable flag");
    const enableBody = (await enableResponse.json()) as { flag: { enabled: boolean } };
    assert.equal(enableBody.flag.enabled, true);

    // checkFlag returns true when flag is enabled
    const flagOnValue = await checkFlag(flagKey);
    assert.equal(flagOnValue, true, "checkFlag returns true for enabled flag");

    // checkFlag returns false for unknown key (no DB row)
    const unknownValue = await checkFlag(`unknown.key.${suffix}`);
    assert.equal(unknownValue, false, "checkFlag returns false for unknown key");

    // loadFlagMap returns correct values
    const flagMap = await loadFlagMap([flagKey, `unknown.key.${suffix}`]);
    assert.equal(flagMap[flagKey], true);
    assert.equal(flagMap[`unknown.key.${suffix}`], undefined);

    // Audit rows exist for create and enable
    const createAuditRow = await db.auditLog.findFirst({
      where: { action: "admin.flag.create", entityType: "FeatureFlag", entityId: flagId },
    });
    assert.ok(createAuditRow, "audit row for flag create");

    const enableAuditRow = await db.auditLog.findFirst({
      where: { action: "admin.flag.enable", entityType: "FeatureFlag", entityId: flagId },
    });
    assert.ok(enableAuditRow, "audit row for flag enable");

    // Admin cannot delete (owner-only)
    const adminDeleteResponse = await deleteFlagRoute(
      authedRequest(`http://homebase.local/api/admin/flags/${flagId}`, "DELETE", admin.sessionId),
      { params: { id: flagId } },
    );
    assert.equal(adminDeleteResponse.status, 403, "admin cannot delete flag");

    // Owner can delete
    const deleteResponse = await deleteFlagRoute(
      authedRequest(`http://homebase.local/api/admin/flags/${flagId}`, "DELETE", owner.sessionId),
      { params: { id: flagId } },
    );
    assert.equal(deleteResponse.status, 204, "owner can delete flag");
    createdFlagIds.splice(createdFlagIds.indexOf(flagId), 1);

    // checkFlag returns false after deletion (no row = default off)
    const afterDeleteValue = await checkFlag(flagKey);
    assert.equal(afterDeleteValue, false, "checkFlag returns false after flag deleted");

    console.log("Admin flags smoke test: OK");
  } finally {
    if (createdFlagIds.length > 0) {
      await db.auditLog.deleteMany({
        where: { entityType: "FeatureFlag", entityId: { in: createdFlagIds } },
      });
      await db.featureFlag.deleteMany({ where: { id: { in: createdFlagIds } } });
    }
    if (sessions.length > 0) {
      await db.session.deleteMany({
        where: { id: { in: sessions.map((s) => s.sessionId) } },
      });
      await db.user.deleteMany({
        where: { id: { in: sessions.map((s) => s.userId) } },
      });
    }
    await db.$disconnect();
  }
}

function authedRequest(url: string, method: string, sessionId: string) {
  return new Request(url, {
    method,
    headers: {
      cookie: `hb_session=${sessionId}; hb_csrf=${csrfToken}`,
      "x-csrf-token": csrfToken,
      "user-agent": "flags-smoke-test",
      "x-forwarded-for": "127.0.0.1",
    },
  });
}

function jsonRequest(url: string, method: string, sessionId: string, body: unknown) {
  return new Request(url, {
    method,
    headers: {
      cookie: `hb_session=${sessionId}; hb_csrf=${csrfToken}`,
      "x-csrf-token": csrfToken,
      "user-agent": "flags-smoke-test",
      "x-forwarded-for": "127.0.0.1",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function createTestSession(role: Role, label: string): Promise<TestSession> {
  const user = await db.user.create({
    data: { email: `${label}@example.test`, passwordHash: "not-used", role },
  });

  const sessionId = `flag-smoke-${randomUUID()}`;
  await db.session.create({
    data: {
      id: sessionId,
      userId: user.id,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      ipAddress: "127.0.0.1",
      userAgent: "flags-smoke-test",
    },
  });

  return { userId: user.id, sessionId };
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
