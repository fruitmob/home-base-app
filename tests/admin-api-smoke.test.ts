import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { GET as listAdminAudit } from "@/app/api/admin/audit/route";
import { PATCH as updateAdminUserRoute } from "@/app/api/admin/users/[id]/route";
import {
  GET as listAdminUsersRoute,
  POST as createAdminUserRoute,
} from "@/app/api/admin/users/route";
import { GaugeToolCallStatus, Role } from "@/generated/prisma/client";
import {
  listPendingGaugeWriteToolCallsForAdmin,
  listRecentGaugeWriteToolCallsForAdmin,
} from "@/lib/gauge/admin";
import { db } from "@/lib/db";

const csrfToken = "admin-api-smoke-csrf";

type TestSession = {
  userId: string;
  sessionId: string;
  email: string;
  role: Role;
};

async function main() {
  const suffix = randomUUID().slice(0, 8);
  const sessions: TestSession[] = [];
  const createdUserIds: string[] = [];
  const conversationIds: string[] = [];
  const toolCallIds: string[] = [];

  try {
    const owner = await createTestSession(Role.OWNER, `owner-${suffix}`);
    const admin = await createTestSession(Role.ADMIN, `admin-${suffix}`);
    const viewer = await createTestSession(Role.VIEWER, `viewer-${suffix}`);
    sessions.push(owner, admin, viewer);

    const viewerListResponse = await listAdminUsersRoute(
      authedRequest("http://homebase.local/api/admin/users", "GET", viewer.sessionId),
    );
    await expectStatus(viewerListResponse, 403, "viewer admin user list");

    const adminCreateOwnerResponse = await createAdminUserRoute(
      jsonRequest("http://homebase.local/api/admin/users", "POST", admin.sessionId, {
        email: `owner-blocked-${suffix}@example.test`,
        password: "temporary-pass-123",
        role: "OWNER",
      }),
    );
    await expectStatus(adminCreateOwnerResponse, 403, "admin cannot create owner");

    const createManagedUserResponse = await createAdminUserRoute(
      jsonRequest("http://homebase.local/api/admin/users", "POST", owner.sessionId, {
        email: `managed-${suffix}@example.test`,
        password: "temporary-pass-123",
        role: "SERVICE_WRITER",
      }),
    );
    await expectStatus(createManagedUserResponse, 201, "owner create managed user");
    const createManagedUserBody = (await createManagedUserResponse.json()) as {
      user: { id: string; email: string; role: Role; isActive: boolean };
    };
    const managedUserId = createManagedUserBody.user.id;
    createdUserIds.push(managedUserId);
    assert.equal(createManagedUserBody.user.role, Role.SERVICE_WRITER);
    assert.equal(createManagedUserBody.user.isActive, true);

    const listUsersResponse = await listAdminUsersRoute(
      authedRequest(
        `http://homebase.local/api/admin/users?q=${encodeURIComponent(`managed-${suffix}`)}&status=all`,
        "GET",
        admin.sessionId,
      ),
    );
    await expectStatus(listUsersResponse, 200, "admin user list");
    const listUsersBody = (await listUsersResponse.json()) as {
      counts: { active: number; inactive: number; total: number };
      users: Array<{ id: string; role: Role; isActive: boolean }>;
    };
    assert.ok(listUsersBody.users.some((user) => user.id === managedUserId));
    assert.ok(listUsersBody.counts.total >= 4);

    const changeRoleResponse = await updateAdminUserRoute(
      jsonRequest(`http://homebase.local/api/admin/users/${managedUserId}`, "PATCH", admin.sessionId, {
        role: "PARTS",
      }),
      routeContext(managedUserId),
    );
    await expectStatus(changeRoleResponse, 200, "admin role change");
    const changeRoleBody = (await changeRoleResponse.json()) as {
      user: { id: string; role: Role; isActive: boolean };
    };
    assert.equal(changeRoleBody.user.role, Role.PARTS);
    assert.equal(changeRoleBody.user.isActive, true);

    const disableManagedUserResponse = await updateAdminUserRoute(
      jsonRequest(`http://homebase.local/api/admin/users/${managedUserId}`, "PATCH", admin.sessionId, {
        isActive: false,
      }),
      routeContext(managedUserId),
    );
    await expectStatus(disableManagedUserResponse, 200, "admin disable managed user");
    const disableManagedUserBody = (await disableManagedUserResponse.json()) as {
      user: { id: string; isActive: boolean };
    };
    assert.equal(disableManagedUserBody.user.isActive, false);

    const disableOwnerResponse = await updateAdminUserRoute(
      jsonRequest(`http://homebase.local/api/admin/users/${owner.userId}`, "PATCH", admin.sessionId, {
        isActive: false,
      }),
      routeContext(owner.userId),
    );
    await expectStatus(disableOwnerResponse, 403, "admin cannot disable owner");

    const selfDisableResponse = await updateAdminUserRoute(
      jsonRequest(`http://homebase.local/api/admin/users/${owner.userId}`, "PATCH", owner.sessionId, {
        isActive: false,
      }),
      routeContext(owner.userId),
    );
    await expectStatus(selfDisableResponse, 400, "owner cannot disable self");

    const restoreManagedUserResponse = await updateAdminUserRoute(
      jsonRequest(`http://homebase.local/api/admin/users/${managedUserId}`, "PATCH", admin.sessionId, {
        isActive: true,
      }),
      routeContext(managedUserId),
    );
    await expectStatus(restoreManagedUserResponse, 200, "admin restore managed user");
    const restoreManagedUserBody = (await restoreManagedUserResponse.json()) as {
      user: { id: string; isActive: boolean };
    };
    assert.equal(restoreManagedUserBody.user.isActive, true);

    const auditResponse = await listAdminAudit(
      authedRequest(
        `http://homebase.local/api/admin/audit?action=${encodeURIComponent("admin.user.disable")}`,
        "GET",
        admin.sessionId,
      ),
    );
    await expectStatus(auditResponse, 200, "admin audit list");
    const auditBody = (await auditResponse.json()) as {
      entries: Array<{ action: string; entityId: string | null }>;
    };
    assert.ok(
      auditBody.entries.some(
        (entry) => entry.action === "admin.user.disable" && entry.entityId === managedUserId,
      ),
      "expected disable action in admin audit list",
    );

    const viewerAuditResponse = await listAdminAudit(
      authedRequest("http://homebase.local/api/admin/audit", "GET", viewer.sessionId),
    );
    await expectStatus(viewerAuditResponse, 403, "viewer audit access");

    const conversation = await db.gaugeConversation.create({
      data: {
        userId: admin.userId,
        title: `Admin smoke ${suffix}`,
        provider: "mock",
        model: "mock-gauge",
      },
    });
    conversationIds.push(conversation.id);

    const pendingToolCall = await db.gaugeToolCall.create({
      data: {
        conversationId: conversation.id,
        userId: admin.userId,
        toolName: "create_estimate_draft_from_draft",
        status: GaugeToolCallStatus.BLOCKED,
        inputJson: { workOrderNumber: `WO-${suffix}` },
        writeRequested: true,
      },
    });
    toolCallIds.push(pendingToolCall.id);

    const pendingGaugeWrites = await listPendingGaugeWriteToolCallsForAdmin(20);
    assert.ok(
      pendingGaugeWrites.some((toolCall) => toolCall.id === pendingToolCall.id),
      "expected pending Gauge write in admin helper list",
    );

    const recentGaugeWrites = await listRecentGaugeWriteToolCallsForAdmin(20);
    assert.ok(
      recentGaugeWrites.some((toolCall) => toolCall.id === pendingToolCall.id),
      "expected recent Gauge write in admin helper list",
    );

    await assertAuditRows([
      ["admin.user.create", managedUserId],
      ["admin.user.role_change", managedUserId],
      ["admin.user.disable", managedUserId],
      ["admin.user.restore", managedUserId],
    ]);

    console.log("Admin API smoke test: OK");
  } finally {
    if (toolCallIds.length > 0) {
      await db.gaugeToolCall.deleteMany({
        where: { id: { in: toolCallIds } },
      });
    }

    if (conversationIds.length > 0) {
      await db.gaugeConversation.deleteMany({
        where: { id: { in: conversationIds } },
      });
    }

    if (createdUserIds.length > 0) {
      await db.auditLog.deleteMany({
        where: { entityId: { in: createdUserIds } },
      });

      await db.session.deleteMany({
        where: { userId: { in: createdUserIds } },
      });

      await db.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }

    if (sessions.length > 0) {
      await db.session.deleteMany({
        where: { id: { in: sessions.map((session) => session.sessionId) } },
      });
      await db.user.deleteMany({
        where: { id: { in: sessions.map((session) => session.userId) } },
      });
    }

    await db.$disconnect();
  }
}

function routeContext(id: string) {
  return { params: { id } };
}

function authedRequest(url: string, method: string, sessionId: string) {
  return new Request(url, {
    method,
    headers: authHeaders(sessionId),
  });
}

function jsonRequest(url: string, method: string, sessionId: string, body: unknown) {
  return new Request(url, {
    method,
    headers: {
      ...authHeaders(sessionId),
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function authHeaders(sessionId: string) {
  return {
    cookie: `hb_session=${sessionId}; hb_csrf=${csrfToken}`,
    "x-csrf-token": csrfToken,
    "user-agent": "admin-api-smoke-test",
    "x-forwarded-for": "127.0.0.1",
  };
}

async function createTestSession(role: Role, label: string): Promise<TestSession> {
  const user = await db.user.create({
    data: {
      email: `admin-api-${label}@example.test`,
      passwordHash: "not-used",
      role,
    },
  });
  const sessionId = `admin-api-${randomUUID()}`;

  await db.session.create({
    data: {
      id: sessionId,
      userId: user.id,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      ipAddress: "127.0.0.1",
      userAgent: "admin-api-smoke-test",
    },
  });

  return {
    userId: user.id,
    sessionId,
    email: user.email,
    role: user.role,
  };
}

async function expectStatus(response: Response, expected: number, label: string) {
  if (response.status !== expected) {
    throw new Error(`${label} returned ${response.status}: ${await response.text()}`);
  }
}

async function assertAuditRows(rows: Array<[string, string]>) {
  for (const [action, entityId] of rows) {
    const auditRow = await db.auditLog.findFirst({
      where: {
        action,
        entityType: "User",
        entityId,
      },
    });

    assert.ok(auditRow, `Missing audit row for ${action} ${entityId}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
