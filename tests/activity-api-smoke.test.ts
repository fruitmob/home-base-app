import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Role } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { POST as apiActivitiesListCreate, GET as apiActivitiesListGet } from "@/app/api/activities/route";
import { PATCH as apiActivitiesPatch, DELETE as apiActivitiesDelete } from "@/app/api/activities/[id]/route";
import { POST as apiLeadsCreate } from "@/app/api/leads/route";

const csrfToken = "activity-api-smoke-csrf";

type TestSession = {
  userId: string;
  sessionId: string;
};

async function main() {
  const suffix = randomUUID();
  const sessionUserIds: string[] = [];
  const sessions: TestSession[] = [];
  const leadIds: string[] = [];
  const activityIds: string[] = [];

  try {
    const adminUser = await createTestSession(Role.ADMIN, `admin-${suffix}`);
    const repUser1 = await createTestSession(Role.SALES_REP, `rep1-${suffix}`);
    const repUser2 = await createTestSession(Role.SALES_REP, `rep2-${suffix}`);
    sessions.push(adminUser, repUser1, repUser2);

    // 1. Create a lead to attach activities to
    const leadCreateRes = await apiLeadsCreate(
      jsonRequest("http://homebase.local/api/leads", "POST", repUser1.sessionId, {
        firstName: "Activity",
        lastName: "Tester",
        phone: "555-555-5555",
        ownerUserId: repUser1.userId,
      })
    );
    await expectStatus(leadCreateRes, 201, "create lead");
    const leadBody = await readJson<any>(leadCreateRes);
    const leadId = leadBody.lead ? leadBody.lead.id : leadBody.id;
    leadIds.push(leadId);

    console.log("Testing zero parents...");
    const noParentRes = await apiActivitiesListCreate(
      jsonRequest("http://homebase.local/api/activities", "POST", adminUser.sessionId, {
        type: "NOTE",
        subject: "Floating Note",
      })
    );
    await expectStatus(noParentRes, 400, "Should reject empty parents");

    console.log("Testing multiple parents...");
    const multiParentRes = await apiActivitiesListCreate(
      jsonRequest("http://homebase.local/api/activities", "POST", adminUser.sessionId, {
        type: "NOTE",
        subject: "Confused Note",
        leadId,
        opportunityId: "some-id",
      })
    );
    await expectStatus(multiParentRes, 400, "Should reject multiple parents");

    console.log("Testing creating valid note...");
    const noteRes = await apiActivitiesListCreate(
      jsonRequest("http://homebase.local/api/activities", "POST", repUser1.sessionId, {
        type: "NOTE",
        subject: "Good Note",
        body: "I am a helpful note.",
        leadId: leadId,
      })
    );
    await expectStatus(noteRes, 201, "Creates Note");
    const noteBody = await readJson<any>(noteRes);
    assert.equal(noteBody.status, "COMPLETED", "Notes should auto-complete");
    activityIds.push(noteBody.id);

    console.log("Testing creating task...");
    const taskRes = await apiActivitiesListCreate(
      jsonRequest("http://homebase.local/api/activities", "POST", repUser1.sessionId, {
        type: "TASK",
        subject: "Follow up",
        leadId: leadId,
      })
    );
    await expectStatus(taskRes, 201, "Creates Task");
    const taskBody = await readJson<any>(taskRes);
    assert.equal(taskBody.status, "OPEN", "Tasks should default OPEN");
    activityIds.push(taskBody.id);

    console.log("Testing permissions...");
    const rep2Fail = await apiActivitiesPatch(
      jsonRequest(`http://homebase.local/api/activities/${taskBody.id}`, "PATCH", repUser2.sessionId, {
        status: "CANCELED"
      }),
      routeContext(taskBody.id)
    );
    await expectStatus(rep2Fail, 403, "Rep2 cannot mutate Rep1's activity on Rep1's lead");

    console.log("Testing completion...");
    const completeRes = await apiActivitiesPatch(
      jsonRequest(`http://homebase.local/api/activities/${taskBody.id}`, "PATCH", repUser1.sessionId, {
        status: "COMPLETED"
      }),
      routeContext(taskBody.id)
    );
    await expectStatus(completeRes, 200, "Completes task");
    const completedTask = await readJson<any>(completeRes);
    assert.ok(completedTask.completedAt != null, "Expected completedAt to be set");

    console.log("Testing fetching...");
    const fetchRes = await apiActivitiesListGet(
      authedRequest(`http://homebase.local/api/activities?leadId=${leadId}`, "GET", repUser1.sessionId)
    );
    await expectStatus(fetchRes, 200, "Fetches list");
    const listBody = await readJson<any[]>(fetchRes);
    assert.equal(listBody.length, 2, "Should return 2 activities");
    assert.equal(listBody[0].ownerUser.id, repUser1.userId, "Returns nested user");

    // Verify Audits
    await assertAuditRows([
      ["lead.create", "Lead", leadId],
      ["activity.create", "Activity", noteBody.id], // Note
      ["activity.create", "Activity", taskBody.id], // Task
      ["activity.update", "Activity", taskBody.id], // Completes Task
    ]);
    
    console.log("Activity API smoke test: OK");
  } finally {
    await cleanup({ sessionUserIds, sessions, leadIds, activityIds });
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

function jsonRequest(url: string, method: string, sessionId: string | null, body: unknown) {
  return new Request(url, {
    method,
    headers: {
      ...(sessionId ? authHeaders(sessionId) : {}),
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function authHeaders(sessionId: string) {
  return {
    cookie: `hb_session=${sessionId}; hb_csrf=${csrfToken}`,
    "x-csrf-token": csrfToken,
    "user-agent": "activity-api-smoke-test",
    "x-forwarded-for": "127.0.0.1",
  };
}

async function createTestSession(role: Role, label: string): Promise<TestSession> {
  const user = await db.user.create({
    data: {
      email: `activity-api-${label}@example.test`,
      passwordHash: "not-used",
      role,
    },
  });
  const sessionId = `activity-api-${randomUUID()}`;

  await db.session.create({
    data: {
      id: sessionId,
      userId: user.id,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      ipAddress: "127.0.0.1",
      userAgent: "activity-api-smoke-test",
    },
  });

  return { userId: user.id, sessionId };
}

async function expectStatus(response: Response, expected: number, label: string) {
  if (response.status !== expected) {
    throw new Error(`${label} returned ${response.status}: ${await response.text()}`);
  }
}

async function readJson<T>(response: Response) {
  return (await response.json()) as T;
}

async function assertAuditRows(rows: Array<[string, string, string]>) {
  for (const [action, entityType, entityId] of rows) {
    const auditRow = await db.auditLog.findFirst({
      where: { action, entityType, entityId },
    });

    assert.ok(auditRow, `Missing audit row for ${action} ${entityId}`);
  }
}

async function cleanup({
  sessionUserIds,
  sessions,
  leadIds,
  activityIds,
}: {
  sessionUserIds: string[];
  sessions: TestSession[];
  leadIds: string[];
  activityIds: string[];
}) {
  const auditIds = [...leadIds, ...activityIds];
  if (auditIds.length > 0) {
    await db.auditLog.deleteMany({ where: { entityId: { in: auditIds } } });
  }

  if (activityIds.length > 0) {
    await db.activity.deleteMany({ where: { id: { in: activityIds } } });
  }

  if (leadIds.length > 0) {
    await db.lead.deleteMany({ where: { id: { in: leadIds } } });
  }

  if (sessions.length > 0) {
    await db.session.deleteMany({
      where: { id: { in: sessions.map((s) => s.sessionId) } },
    });
    await db.user.deleteMany({
      where: { id: { in: sessions.map((s) => s.userId) } },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
