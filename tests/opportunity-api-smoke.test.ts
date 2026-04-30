import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Role } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { GET as listOpportunities, POST as createOpportunity } from "@/app/api/opportunities/route";
import {
  GET as getOpportunity,
  PATCH as updateOpportunity,
  DELETE as deleteOpportunity,
} from "@/app/api/opportunities/[id]/route";
import { PATCH as updateStage } from "@/app/api/opportunities/[id]/stage/route";

const csrfToken = "opp-api-smoke-csrf";

type TestSession = {
  userId: string;
  sessionId: string;
};

type OpportunityPayload = {
  id: string;
  name: string;
  stage: string;
  amount: string | number;
  ownerUserId: string | null;
  customerId: string;
};

async function main() {
  const suffix = randomUUID();
  const sessionUserIds: string[] = [];
  const sessions: TestSession[] = [];
  const oppIds: string[] = [];
  const customerIds: string[] = [];

  try {
    const adminUser = await createTestSession(Role.ADMIN, `admin-${suffix}`);
    const repUser1 = await createTestSession(Role.SALES_REP, `rep1-${suffix}`);
    const repUser2 = await createTestSession(Role.SALES_REP, `rep2-${suffix}`);
    sessions.push(adminUser, repUser1, repUser2);

    // Create a customer for linking
    const customer = await db.customer.create({
      data: {
        displayName: "Test Oppy Customer",
        email: "test.oppy@example.test",
        phone: "555-1010",
      }
    });
    customerIds.push(customer.id);

    // 1. Create an opportunity as admin
    const createResponse = await createOpportunity(
      jsonRequest("http://homebase.local/api/opportunities", "POST", adminUser.sessionId, {
        name: "Admin Unassigned Opp",
        customerId: customer.id,
        amount: 5000,
      }),
    );
    await expectStatus(createResponse, 201, "admin create opp");
    const oppBody = await readJson<OpportunityPayload>(createResponse);
    console.log("CREATED OPP:", oppBody);
    assert.equal(Number(oppBody.amount), 5000);
    oppIds.push(oppBody.id);

    // 2. rep1 claims the unassigned opp
    const claimResponse = await updateOpportunity(
      jsonRequest(
        `http://homebase.local/api/opportunities/${oppBody.id}`,
        "PATCH",
        repUser1.sessionId,
        {
          ownerUserId: repUser1.userId,
        },
      ),
      routeContext(oppBody.id),
    );
    await expectStatus(claimResponse, 200, "rep1 claim unassigned opp");

    // 3. Check normal update doesn't update stage even if passed
    const tryStageUpdateResponse = await updateOpportunity(
      jsonRequest(
        `http://homebase.local/api/opportunities/${oppBody.id}`,
        "PATCH",
        repUser1.sessionId,
        {
          stage: "NEGOTIATION",
          name: "Updated Name",
        },
      ),
      routeContext(oppBody.id),
    );
    const tryStageBody = await readJson<OpportunityPayload>(tryStageUpdateResponse);
    assert.equal(tryStageBody.name, "Updated Name", "Name should be updated");
    assert.equal(tryStageBody.stage, "NEW", "Stage should NOT be updated by standard PATCH route");

    // 4. Rep2 tries to edit Rep1's opp
    const blockUpdateResponse = await updateOpportunity(
      jsonRequest(
        `http://homebase.local/api/opportunities/${oppBody.id}`,
        "PATCH",
        repUser2.sessionId,
        {
          name: "Hacked Name",
        },
      ),
      routeContext(oppBody.id),
    );
    await expectStatus(blockUpdateResponse, 403, "rep2 attempts to edit rep1's opp");

    // 5. Change stage using specific endpoint
    const stageUpdate1 = await updateStage(
      jsonRequest(
        `http://homebase.local/api/opportunities/${oppBody.id}/stage`,
        "PATCH",
        repUser1.sessionId,
        { stage: "QUALIFIED" }
      ),
      routeContext(oppBody.id)
    );
    await expectStatus(stageUpdate1, 200, "change stage to QUALIFIED");

    // 6. Transition to WON
    const stageUpdate2 = await updateStage(
      jsonRequest(
        `http://homebase.local/api/opportunities/${oppBody.id}/stage`,
        "PATCH",
        repUser1.sessionId,
        { stage: "WON" }
      ),
      routeContext(oppBody.id)
    );
    await expectStatus(stageUpdate2, 200, "change stage to WON");

    // 7. Try transitioning OUT of WON (should fail 400 terminal state)
    const stageUpdateFail = await updateStage(
      jsonRequest(
        `http://homebase.local/api/opportunities/${oppBody.id}/stage`,
        "PATCH",
        repUser1.sessionId,
        { stage: "PROPOSAL" }
      ),
      routeContext(oppBody.id)
    );
    await expectStatus(stageUpdateFail, 400, "change out of terminal WON state should fail");

    // 8. Delete Opp
    const deleteResponse = await deleteOpportunity(
      authedRequest(
        `http://homebase.local/api/opportunities/${oppBody.id}`,
        "DELETE",
        repUser1.sessionId,
      ),
      routeContext(oppBody.id),
    );
    await expectStatus(deleteResponse, 204, "rep1 deletes owned opp");

    // Verify audits
    await assertAuditRows([
      ["opportunity.create", "Opportunity", oppBody.id],
      ["opportunity.update", "Opportunity", oppBody.id], // The claim
      ["opportunity.update", "Opportunity", oppBody.id], // The name edit
      ["opportunity.stage", "Opportunity", oppBody.id], // NEW -> QUALIFIED
      ["opportunity.stage", "Opportunity", oppBody.id], // QUALIFIED -> WON
      ["opportunity.delete", "Opportunity", oppBody.id],
    ]);

    console.log("Opportunity API smoke test: OK");
  } finally {
    await cleanup({ sessionUserIds, sessions, oppIds, customerIds });
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
    "user-agent": "opp-api-smoke-test",
    "x-forwarded-for": "127.0.0.1",
  };
}

async function createTestSession(role: Role, label: string): Promise<TestSession> {
  const user = await db.user.create({
    data: {
      email: `opp-api-${label}@example.test`,
      passwordHash: "not-used",
      role,
    },
  });
  const sessionId = `opp-api-${randomUUID()}`;

  await db.session.create({
    data: {
      id: sessionId,
      userId: user.id,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      ipAddress: "127.0.0.1",
      userAgent: "opp-api-smoke-test",
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
  oppIds,
  customerIds,
}: {
  sessionUserIds: string[];
  sessions: TestSession[];
  oppIds: string[];
  customerIds: string[];
}) {
  const auditIds = [...oppIds, ...customerIds];
  if (auditIds.length > 0) {
    await db.auditLog.deleteMany({ where: { entityId: { in: auditIds } } });
  }

  if (oppIds.length > 0) {
    await db.opportunity.deleteMany({ where: { id: { in: oppIds } } });
  }
  
  if (customerIds.length > 0) {
    await db.customer.deleteMany({ where: { id: { in: customerIds } } });
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
