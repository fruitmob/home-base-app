import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { OpportunityStage, Role } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { GET as listGoals, POST as createGoal } from "@/app/api/sales-goals/route";
import {
  GET as getGoal,
  PATCH as updateGoal,
  DELETE as deleteGoal,
} from "@/app/api/sales-goals/[id]/route";
import { attainment } from "@/lib/sales/goals";

const csrfToken = "sales-goal-api-smoke-csrf";

type TestSession = {
  userId: string;
  sessionId: string;
};

type SalesGoalPayload = {
  goal: {
    id: string;
    userId: string;
    period: string;
    targetAmount: string | number;
    notes: string | null;
    attainmentAmount?: number;
    attainmentPercent?: number;
  };
};

async function main() {
  const suffix = randomUUID();
  const sessions: TestSession[] = [];
  const goalIds: string[] = [];
  const opportunityIds: string[] = [];
  const customerIds: string[] = [];

  try {
    const admin = await createTestSession(Role.ADMIN, `admin-${suffix}`);
    const rep = await createTestSession(Role.SALES_REP, `rep-${suffix}`);
    sessions.push(admin, rep);

    const customer = await db.customer.create({
      data: {
        displayName: "Sales Goal Smoke Customer",
        email: `goal-${suffix}@example.test`,
      },
    });
    customerIds.push(customer.id);

    const wonAprilA = await db.opportunity.create({
      data: {
        customerId: customer.id,
        ownerUserId: rep.userId,
        name: "April Won A",
        stage: OpportunityStage.WON,
        amount: 2000,
        closedAt: new Date("2026-04-05T12:00:00.000Z"),
      },
    });
    const wonAprilB = await db.opportunity.create({
      data: {
        customerId: customer.id,
        ownerUserId: rep.userId,
        name: "April Won B",
        stage: OpportunityStage.WON,
        amount: 500,
        closedAt: new Date("2026-04-20T12:00:00.000Z"),
      },
    });
    const outsidePeriod = await db.opportunity.create({
      data: {
        customerId: customer.id,
        ownerUserId: rep.userId,
        name: "May Won",
        stage: OpportunityStage.WON,
        amount: 9000,
        closedAt: new Date("2026-05-02T12:00:00.000Z"),
      },
    });
    opportunityIds.push(wonAprilA.id, wonAprilB.id, outsidePeriod.id);

    assert.equal(await attainment(rep.userId, "2026-04"), 2500);

    const createResponse = await createGoal(
      jsonRequest("http://homebase.local/api/sales-goals", "POST", admin.sessionId, {
        userId: rep.userId,
        period: "2026-04",
        targetAmount: 3000,
        notes: "April quota",
      }),
    );
    await expectStatus(createResponse, 201, "create sales goal");
    const createBody = await readJson<SalesGoalPayload>(createResponse);
    goalIds.push(createBody.goal.id);
    assert.equal(createBody.goal.userId, rep.userId);
    assert.equal(createBody.goal.period, "2026-04");

    const duplicateResponse = await createGoal(
      jsonRequest("http://homebase.local/api/sales-goals", "POST", admin.sessionId, {
        userId: rep.userId,
        period: "2026-04",
        targetAmount: 4000,
      }),
    );
    await expectStatus(duplicateResponse, 409, "duplicate sales goal is rejected");

    const repListResponse = await listGoals(
      authedRequest(
        "http://homebase.local/api/sales-goals?period=2026-04",
        "GET",
        rep.sessionId,
      ),
    );
    await expectStatus(repListResponse, 200, "rep list own goals");
    const repListBody = await readJson<{ goals: Array<SalesGoalPayload["goal"]> }>(repListResponse);
    const listedGoal = repListBody.goals.find((goal) => goal.id === createBody.goal.id);
    assert.ok(listedGoal, "rep should see own goal");
    assert.equal(listedGoal.attainmentAmount, 2500);
    assert.equal(listedGoal.attainmentPercent, 83);

    const adminGoal = await db.salesGoal.create({
      data: {
        userId: admin.userId,
        period: "2026-04",
        targetAmount: 1000,
      },
    });
    goalIds.push(adminGoal.id);

    const blockedGetResponse = await getGoal(
      authedRequest(
        `http://homebase.local/api/sales-goals/${adminGoal.id}`,
        "GET",
        rep.sessionId,
      ),
      routeContext(adminGoal.id),
    );
    await expectStatus(blockedGetResponse, 403, "rep cannot read another user's goal");

    const getResponse = await getGoal(
      authedRequest(
        `http://homebase.local/api/sales-goals/${createBody.goal.id}`,
        "GET",
        rep.sessionId,
      ),
      routeContext(createBody.goal.id),
    );
    await expectStatus(getResponse, 200, "rep can read own goal");
    const getBody = await readJson<SalesGoalPayload>(getResponse);
    assert.equal(getBody.goal.attainmentAmount, 2500);

    const patchResponse = await updateGoal(
      jsonRequest(
        `http://homebase.local/api/sales-goals/${createBody.goal.id}`,
        "PATCH",
        admin.sessionId,
        { targetAmount: 5000, notes: "Adjusted April quota" },
      ),
      routeContext(createBody.goal.id),
    );
    await expectStatus(patchResponse, 200, "update sales goal");
    const patchBody = await readJson<SalesGoalPayload>(patchResponse);
    assert.equal(Number(patchBody.goal.targetAmount), 5000);
    assert.equal(patchBody.goal.notes, "Adjusted April quota");

    const blockedPatchResponse = await updateGoal(
      jsonRequest(
        `http://homebase.local/api/sales-goals/${createBody.goal.id}`,
        "PATCH",
        rep.sessionId,
        { targetAmount: 1 },
      ),
      routeContext(createBody.goal.id),
    );
    await expectStatus(blockedPatchResponse, 403, "rep cannot mutate goals");

    const deleteResponse = await deleteGoal(
      authedRequest(
        `http://homebase.local/api/sales-goals/${createBody.goal.id}`,
        "DELETE",
        admin.sessionId,
      ),
      routeContext(createBody.goal.id),
    );
    await expectStatus(deleteResponse, 200, "soft-delete sales goal");

    const getDeletedResponse = await getGoal(
      authedRequest(
        `http://homebase.local/api/sales-goals/${createBody.goal.id}`,
        "GET",
        admin.sessionId,
      ),
      routeContext(createBody.goal.id),
    );
    await expectStatus(getDeletedResponse, 404, "deleted goal is hidden");

    await assertAuditRows([
      ["sales_goal.create", "SalesGoal", createBody.goal.id],
      ["sales_goal.update", "SalesGoal", createBody.goal.id],
      ["sales_goal.delete", "SalesGoal", createBody.goal.id],
    ]);

    console.log("Sales Goal API smoke test: OK");
  } finally {
    await cleanup({ sessions, goalIds, opportunityIds, customerIds });
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
    "user-agent": "sales-goal-api-smoke-test",
    "x-forwarded-for": "127.0.0.1",
  };
}

async function createTestSession(role: Role, label: string): Promise<TestSession> {
  const user = await db.user.create({
    data: {
      email: `sales-goal-api-${label}@example.test`,
      passwordHash: "not-used",
      role,
    },
  });
  const sessionId = `sales-goal-api-${randomUUID()}`;

  await db.session.create({
    data: {
      id: sessionId,
      userId: user.id,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      ipAddress: "127.0.0.1",
      userAgent: "sales-goal-api-smoke-test",
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
  sessions,
  goalIds,
  opportunityIds,
  customerIds,
}: {
  sessions: TestSession[];
  goalIds: string[];
  opportunityIds: string[];
  customerIds: string[];
}) {
  const entityIds = [...goalIds, ...opportunityIds, ...customerIds];
  if (entityIds.length > 0) {
    await db.auditLog.deleteMany({ where: { entityId: { in: entityIds } } });
  }

  if (goalIds.length > 0) {
    await db.salesGoal.deleteMany({ where: { id: { in: goalIds } } });
  }

  if (opportunityIds.length > 0) {
    await db.opportunity.deleteMany({ where: { id: { in: opportunityIds } } });
  }

  if (customerIds.length > 0) {
    await db.customer.deleteMany({ where: { id: { in: customerIds } } });
  }

  if (sessions.length > 0) {
    await db.session.deleteMany({
      where: { id: { in: sessions.map((session) => session.sessionId) } },
    });
    await db.user.deleteMany({
      where: { id: { in: sessions.map((session) => session.userId) } },
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
