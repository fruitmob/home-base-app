import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Role } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { GET as listLeads, POST as createLead } from "@/app/api/leads/route";
import {
  GET as getLead,
  PATCH as updateLead,
  DELETE as deleteLead,
} from "@/app/api/leads/[id]/route";
import { POST as convertLead } from "@/app/api/leads/[id]/convert/route";

const csrfToken = "lead-api-smoke-csrf";

type TestSession = {
  userId: string;
  sessionId: string;
};

type LeadPayload = {
  lead: {
    id: string;
    displayName: string;
    ownerUserId: string | null;
    status: string;
  };
};

async function main() {
  const suffix = randomUUID();
  const sessionUserIds: string[] = [];
  const sessions: TestSession[] = [];
  const leadIds: string[] = [];
  const customerIds: string[] = [];
  const opportunityIds: string[] = [];

  try {
    const adminUser = await createTestSession(Role.ADMIN, `admin-${suffix}`);
    const repUser1 = await createTestSession(Role.SALES_REP, `rep1-${suffix}`);
    const repUser2 = await createTestSession(Role.SALES_REP, `rep2-${suffix}`);
    sessions.push(adminUser, repUser1, repUser2);

    // 1. Create a lead as an admin (unassigned by default)
    const adminCreateResponse = await createLead(
      jsonRequest("http://homebase.local/api/leads", "POST", adminUser.sessionId, {
        displayName: "Admin Unassigned Lead",
        companyName: "Acme Corp",
      }),
    );
    await expectStatus(adminCreateResponse, 201, "admin create lead");
    const unassignedLeadBody = await readJson<LeadPayload>(adminCreateResponse);
    leadIds.push(unassignedLeadBody.lead.id);

    // 2. rep1 claims the unassigned lead
    const claimResponse = await updateLead(
      jsonRequest(
        `http://homebase.local/api/leads/${unassignedLeadBody.lead.id}`,
        "PATCH",
        repUser1.sessionId,
        {
          ownerUserId: repUser1.userId,
        },
      ),
      routeContext(unassignedLeadBody.lead.id),
    );
    await expectStatus(claimResponse, 200, "rep1 claim unassigned lead");

    // 3. rep2 tries to update rep1's newly claimed lead (should 404 because not owned)
    const blockUpdateResponse = await updateLead(
      jsonRequest(
        `http://homebase.local/api/leads/${unassignedLeadBody.lead.id}`,
        "PATCH",
        repUser2.sessionId,
        {
          displayName: "Hacked Name",
        },
      ),
      routeContext(unassignedLeadBody.lead.id),
    );
    await expectStatus(blockUpdateResponse, 403, "rep2 attempts to edit rep1's lead");

    // 4. rep1 creates their own new lead
    const rep1CreateResponse = await createLead(
      jsonRequest("http://homebase.local/api/leads", "POST", repUser1.sessionId, {
        displayName: "Rep 1 Direct Lead",
        status: "WORKING",
        ownerUserId: repUser1.userId,
      }),
    );
    await expectStatus(rep1CreateResponse, 201, "rep1 creates directly assigned lead");
    const rep1LeadBody = await readJson<LeadPayload>(rep1CreateResponse);
    leadIds.push(rep1LeadBody.lead.id);

    // 5. rep2 lists leads and should NOT see rep1's lead
    const listResponse = await listLeads(
      authedRequest("http://homebase.local/api/leads", "GET", repUser2.sessionId),
    );
    await expectStatus(listResponse, 200, "rep2 list leads");
    const listBody = await readJson<{ leads: { id: string }[] }>(listResponse);
    assert.ok(
      !listBody.leads.some((l) => l.id === rep1LeadBody.lead.id),
      "rep2 should not see rep1's lead",
    );

    // 6. rep1 converts their direct lead
    const convertResponse = await convertLead(
      jsonRequest(
        `http://homebase.local/api/leads/${rep1LeadBody.lead.id}/convert`,
        "POST",
        repUser1.sessionId,
        {
          createCustomer: true,
          companyName: "New Biz LLC",
          displayName: "Jane Doe",
          opportunityName: "Jane - Install",
        },
      ),
      routeContext(rep1LeadBody.lead.id),
    );
    await expectStatus(convertResponse, 200, "rep1 converts lead to customer and opp");
    const convertBody = await readJson<{ opportunity: { id: string; customerId: string } }>(
      convertResponse,
    );
    opportunityIds.push(convertBody.opportunity.id);
    customerIds.push(convertBody.opportunity.customerId);

    // Verify lead status is now CONVERTED
    const verifyLeadResponse = await getLead(
      authedRequest(
        `http://homebase.local/api/leads/${rep1LeadBody.lead.id}`,
        "GET",
        repUser1.sessionId,
      ),
      routeContext(rep1LeadBody.lead.id),
    );
    const convertedLead = await readJson<LeadPayload>(verifyLeadResponse);
    assert.equal(convertedLead.lead.status, "CONVERTED");

    // Double convert should return the existing opportunity idempotently.
    const doubleConvertResponse = await convertLead(
      jsonRequest(
        `http://homebase.local/api/leads/${rep1LeadBody.lead.id}/convert`,
        "POST",
        repUser1.sessionId,
        {
          createCustomer: true,
          companyName: "Should fail",
          displayName: "Should fail",
          opportunityName: "Should fail"
        },
      ),
      routeContext(rep1LeadBody.lead.id),
    );
    await expectStatus(doubleConvertResponse, 200, "double conversion returns existing opportunity");
    const doubleConvertBody = await readJson<{ opportunity: { id: string } }>(doubleConvertResponse);
    assert.equal(doubleConvertBody.opportunity.id, convertBody.opportunity.id);

    // 7. Test delete Lead
    const deleteResponse = await deleteLead(
      authedRequest(
        `http://homebase.local/api/leads/${unassignedLeadBody.lead.id}`,
        "DELETE",
        repUser1.sessionId,
      ),
      routeContext(unassignedLeadBody.lead.id),
    );
    await expectStatus(deleteResponse, 200, "rep1 deletes owned lead");

    // Verify audit logs
    await assertAuditRows([
      ["lead.create", "Lead", unassignedLeadBody.lead.id],
      ["lead.update", "Lead", unassignedLeadBody.lead.id], // The claim
      ["lead.delete", "Lead", unassignedLeadBody.lead.id],
      ["lead.create", "Lead", rep1LeadBody.lead.id],
      ["lead.convert", "Lead", rep1LeadBody.lead.id],
    ]);

    console.log("Lead API smoke test: OK");
  } finally {
    await cleanup({ sessionUserIds, sessions, leadIds, customerIds, opportunityIds });
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
    "user-agent": "lead-api-smoke-test",
    "x-forwarded-for": "127.0.0.1",
  };
}

async function createTestSession(role: Role, label: string): Promise<TestSession> {
  const user = await db.user.create({
    data: {
      email: `lead-api-${label}@example.test`,
      passwordHash: "not-used",
      role,
    },
  });
  const sessionId = `lead-api-${randomUUID()}`;

  await db.session.create({
    data: {
      id: sessionId,
      userId: user.id,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      ipAddress: "127.0.0.1",
      userAgent: "lead-api-smoke-test",
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
  customerIds,
  opportunityIds,
}: {
  sessionUserIds: string[];
  sessions: TestSession[];
  leadIds: string[];
  customerIds: string[];
  opportunityIds: string[];
}) {
  const auditIds = [...leadIds, ...customerIds, ...opportunityIds];
  if (auditIds.length > 0) {
    await db.auditLog.deleteMany({ where: { entityId: { in: auditIds } } });
  }

  if (opportunityIds.length > 0) {
    await db.opportunity.deleteMany({ where: { id: { in: opportunityIds } } });
  }
  
  if (customerIds.length > 0) {
    await db.customer.deleteMany({ where: { id: { in: customerIds } } });
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
