import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Role } from "@/generated/prisma/client";
import {
  startImpersonation,
  stopImpersonation,
  getActiveImpersonation,
} from "@/lib/admin/impersonation";
import { HttpError } from "@/lib/auth";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";

type TestSession = {
  userId: string;
  sessionId: string;
  currentUser: CurrentUser;
};

function makeRequest() {
  return new Request("http://homebase.local/api/admin/impersonation", {
    method: "POST",
    headers: {
      "user-agent": "impersonation-smoke-test",
      "x-forwarded-for": "127.0.0.1",
    },
  });
}

async function createTestSession(role: Role, label: string): Promise<TestSession> {
  const user = await db.user.create({
    data: {
      email: `${label}@example.test`,
      passwordHash: "not-used",
      role,
    },
  });

  const sessionId = `imp-smoke-${randomUUID()}`;
  await db.session.create({
    data: {
      id: sessionId,
      userId: user.id,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      ipAddress: "127.0.0.1",
      userAgent: "impersonation-smoke-test",
    },
  });

  const currentUser: CurrentUser = {
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  return { userId: user.id, sessionId, currentUser };
}

async function main() {
  const suffix = randomUUID().slice(0, 8);
  const sessions: TestSession[] = [];
  const impersonationIds: string[] = [];

  try {
    const owner = await createTestSession(Role.OWNER, `imp-owner-${suffix}`);
    const owner2 = await createTestSession(Role.OWNER, `imp-owner2-${suffix}`);
    const admin = await createTestSession(Role.ADMIN, `imp-admin-${suffix}`);
    const tech = await createTestSession(Role.TECH, `imp-tech-${suffix}`);
    sessions.push(owner, owner2, admin, tech);

    // Non-owner cannot start impersonation
    try {
      await startImpersonation(tech.userId, "Test reason", admin.currentUser, makeRequest());
      assert.fail("admin should not be able to start impersonation");
    } catch (err) {
      assert.ok(err instanceof HttpError, "throws HttpError");
      assert.equal((err as HttpError).status, 403, "non-owner gets 403");
    }

    // Owner cannot impersonate themselves
    try {
      await startImpersonation(owner.userId, "Self test", owner.currentUser, makeRequest());
      assert.fail("owner should not be able to impersonate themselves");
    } catch (err) {
      assert.ok(err instanceof HttpError);
      assert.equal((err as HttpError).status, 400, "self-impersonation gets 400");
    }

    // Owner cannot impersonate another owner
    try {
      await startImpersonation(owner2.userId, "Owner test", owner.currentUser, makeRequest());
      assert.fail("owner should not be able to impersonate another owner");
    } catch (err) {
      assert.ok(err instanceof HttpError);
      assert.equal((err as HttpError).status, 400, "owner→owner gets 400");
    }

    // Missing reason is rejected
    try {
      await startImpersonation(tech.userId, "  ", owner.currentUser, makeRequest());
      assert.fail("blank reason should be rejected");
    } catch (err) {
      assert.ok(err instanceof HttpError);
      assert.equal((err as HttpError).status, 400, "blank reason gets 400");
    }

    // Owner can impersonate a tech
    const impResult = await startImpersonation(
      tech.userId,
      "Reproducing bay display bug",
      owner.currentUser,
      makeRequest(),
    );
    impersonationIds.push(impResult.id);

    assert.equal(impResult.actorUserId, owner.userId, "actor is the owner");
    assert.equal(impResult.targetUserId, tech.userId, "target is the tech");
    assert.equal(impResult.reason, "Reproducing bay display bug");
    assert.equal(impResult.targetRole, Role.TECH);

    // DB record exists with endedAt null
    const dbRecord = await db.impersonation.findUnique({ where: { id: impResult.id } });
    assert.ok(dbRecord, "DB record created");
    assert.equal(dbRecord!.endedAt, null, "endedAt is null while active");

    // Audit entry for start
    const startAudit = await db.auditLog.findFirst({
      where: {
        action: "admin.impersonation.start",
        entityType: "Impersonation",
        entityId: impResult.id,
      },
    });
    assert.ok(startAudit, "audit row for impersonation start");

    // getActiveImpersonation returns the session
    const active = await getActiveImpersonation(impResult.id, owner.userId);
    assert.ok(active, "getActiveImpersonation returns active session");
    assert.equal(active!.targetUserId, tech.userId);

    // Wrong actor gets null
    const wrongActor = await getActiveImpersonation(impResult.id, admin.userId);
    assert.equal(wrongActor, null, "wrong actor cannot access session");

    // Owner can stop the impersonation
    await stopImpersonation(impResult.id, owner.currentUser, makeRequest());

    // DB record now has endedAt set
    const stoppedRecord = await db.impersonation.findUnique({ where: { id: impResult.id } });
    assert.ok(stoppedRecord!.endedAt !== null, "endedAt is set after stop");

    // Audit entry for stop
    const stopAudit = await db.auditLog.findFirst({
      where: {
        action: "admin.impersonation.stop",
        entityType: "Impersonation",
        entityId: impResult.id,
      },
    });
    assert.ok(stopAudit, "audit row for impersonation stop");

    // getActiveImpersonation returns null after stop
    const afterStop = await getActiveImpersonation(impResult.id, owner.userId);
    assert.equal(afterStop, null, "getActiveImpersonation returns null after stop");

    // stopImpersonation is idempotent — calling again does not throw
    await stopImpersonation(impResult.id, owner.currentUser, makeRequest());

    // Cannot impersonate a disabled user
    await db.user.update({
      where: { id: tech.userId },
      data: { deletedAt: new Date() },
    });
    try {
      await startImpersonation(tech.userId, "Disabled test", owner.currentUser, makeRequest());
      assert.fail("should not be able to impersonate disabled user");
    } catch (err) {
      assert.ok(err instanceof HttpError);
      assert.equal((err as HttpError).status, 400, "disabled user gets 400");
    }
    // Restore so cleanup works cleanly
    await db.user.update({
      where: { id: tech.userId },
      data: { deletedAt: null },
    });

    // Starting a second session auto-ends any existing active session
    const imp2 = await startImpersonation(
      admin.userId,
      "Second session test",
      owner.currentUser,
      makeRequest(),
    );
    impersonationIds.push(imp2.id);

    // Start a third to confirm the second was ended
    const imp3 = await startImpersonation(
      tech.userId,
      "Third session replaces second",
      owner.currentUser,
      makeRequest(),
    );
    impersonationIds.push(imp3.id);

    const secondAfterReplace = await db.impersonation.findUnique({ where: { id: imp2.id } });
    assert.ok(secondAfterReplace!.endedAt !== null, "starting a new session ends the prior one");

    console.log("Admin impersonation smoke test: OK");
  } finally {
    if (impersonationIds.length > 0) {
      await db.auditLog.deleteMany({
        where: { entityType: "Impersonation", entityId: { in: impersonationIds } },
      });
      await db.impersonation.deleteMany({ where: { id: { in: impersonationIds } } });
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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
