import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Role } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { GET as listCases, POST as createCase } from "@/app/api/cases/route";
import {
  GET as getCase,
  PATCH as updateCase,
  DELETE as deleteCase,
} from "@/app/api/cases/[id]/route";
import { POST as resolveCase } from "@/app/api/cases/[id]/resolve/route";

const csrfToken = "case-api-smoke-csrf";

type TestSession = {
  userId: string;
  sessionId: string;
};

type CasePayload = {
  case: {
    id: string;
    customerId: string;
    vehicleId: string | null;
    assignedUserId: string | null;
    status: string;
    priority: string;
    subject: string;
    resolvedAt: string | null;
    resolutionNotes: string | null;
  };
};

async function main() {
  const suffix = randomUUID();
  const sessions: TestSession[] = [];
  const caseIds: string[] = [];
  const customerIds: string[] = [];
  const vehicleIds: string[] = [];

  try {
    const serviceWriter = await createTestSession(Role.SERVICE_WRITER, `writer-${suffix}`);
    const viewer = await createTestSession(Role.VIEWER, `viewer-${suffix}`);
    sessions.push(serviceWriter, viewer);

    const customer = await db.customer.create({
      data: {
        displayName: "Case Smoke Customer",
        email: `case-${suffix}@example.test`,
      },
    });
    customerIds.push(customer.id);

    const vehicle = await db.vehicle.create({
      data: {
        customerId: customer.id,
        year: 2024,
        make: "Ford",
        model: "Transit",
        unitNumber: `CASE-${suffix.slice(0, 6)}`,
      },
    });
    vehicleIds.push(vehicle.id);

    const blockedCreate = await createCase(
      jsonRequest("http://homebase.local/api/cases", "POST", viewer.sessionId, {
        customerId: customer.id,
        subject: "Should not save",
      }),
    );
    await expectStatus(blockedCreate, 403, "viewer cannot create case");

    const createResponse = await createCase(
      jsonRequest("http://homebase.local/api/cases", "POST", serviceWriter.sessionId, {
        customerId: customer.id,
        vehicleId: vehicle.id,
        assignedUserId: serviceWriter.userId,
        priority: "HIGH",
        subject: "Customer reported warning light",
        description: "Customer called after delivery.",
      }),
    );
    await expectStatus(createResponse, 201, "create case");
    const createBody = await readJson<CasePayload>(createResponse);
    caseIds.push(createBody.case.id);
    assert.equal(createBody.case.status, "OPEN");
    assert.equal(createBody.case.priority, "HIGH");
    assert.equal(createBody.case.assignedUserId, serviceWriter.userId);

    const listResponse = await listCases(
      authedRequest(
        `http://homebase.local/api/cases?status=OPEN&priority=HIGH&assignedUserId=${serviceWriter.userId}`,
        "GET",
        viewer.sessionId,
      ),
    );
    await expectStatus(listResponse, 200, "viewer can list cases");
    const listBody = await readJson<{ cases: Array<{ id: string }> }>(listResponse);
    assert.ok(listBody.cases.some((supportCase) => supportCase.id === createBody.case.id));

    const patchResponse = await updateCase(
      jsonRequest(
        `http://homebase.local/api/cases/${createBody.case.id}`,
        "PATCH",
        serviceWriter.sessionId,
        {
          status: "WAITING",
          priority: "URGENT",
          subject: "Customer waiting on warning light update",
        },
      ),
      routeContext(createBody.case.id),
    );
    await expectStatus(patchResponse, 200, "update case");
    const patchBody = await readJson<CasePayload>(patchResponse);
    assert.equal(patchBody.case.status, "WAITING");
    assert.equal(patchBody.case.priority, "URGENT");

    const resolveResponse = await resolveCase(
      jsonRequest(
        `http://homebase.local/api/cases/${createBody.case.id}/resolve`,
        "POST",
        serviceWriter.sessionId,
        { resolutionNotes: "Confirmed loose connector and reseated harness." },
      ),
      routeContext(createBody.case.id),
    );
    await expectStatus(resolveResponse, 200, "resolve case");
    const resolveBody = await readJson<CasePayload>(resolveResponse);
    assert.equal(resolveBody.case.status, "RESOLVED");
    assert.ok(resolveBody.case.resolvedAt);
    assert.match(resolveBody.case.resolutionNotes ?? "", /connector/);

    const getResponse = await getCase(
      authedRequest(
        `http://homebase.local/api/cases/${createBody.case.id}`,
        "GET",
        viewer.sessionId,
      ),
      routeContext(createBody.case.id),
    );
    await expectStatus(getResponse, 200, "viewer can read case");

    const deleteResponse = await deleteCase(
      authedRequest(
        `http://homebase.local/api/cases/${createBody.case.id}`,
        "DELETE",
        serviceWriter.sessionId,
      ),
      routeContext(createBody.case.id),
    );
    await expectStatus(deleteResponse, 200, "soft-delete case");

    const getDeletedResponse = await getCase(
      authedRequest(
        `http://homebase.local/api/cases/${createBody.case.id}`,
        "GET",
        serviceWriter.sessionId,
      ),
      routeContext(createBody.case.id),
    );
    await expectStatus(getDeletedResponse, 404, "deleted case is hidden");

    await assertAuditRows([
      ["case.create", "Case", createBody.case.id],
      ["case.update", "Case", createBody.case.id],
      ["case.resolve", "Case", createBody.case.id],
      ["case.delete", "Case", createBody.case.id],
    ]);

    console.log("Case API smoke test: OK");
  } finally {
    await cleanup({ sessions, caseIds, customerIds, vehicleIds });
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
    "user-agent": "case-api-smoke-test",
    "x-forwarded-for": "127.0.0.1",
  };
}

async function createTestSession(role: Role, label: string): Promise<TestSession> {
  const user = await db.user.create({
    data: {
      email: `case-api-${label}@example.test`,
      passwordHash: "not-used",
      role,
    },
  });
  const sessionId = `case-api-${randomUUID()}`;

  await db.session.create({
    data: {
      id: sessionId,
      userId: user.id,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      ipAddress: "127.0.0.1",
      userAgent: "case-api-smoke-test",
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
  caseIds,
  customerIds,
  vehicleIds,
}: {
  sessions: TestSession[];
  caseIds: string[];
  customerIds: string[];
  vehicleIds: string[];
}) {
  const entityIds = [...caseIds, ...customerIds, ...vehicleIds];
  if (entityIds.length > 0) {
    await db.auditLog.deleteMany({ where: { entityId: { in: entityIds } } });
  }

  if (caseIds.length > 0) {
    await db.activity.deleteMany({ where: { caseId: { in: caseIds } } });
    await db.case.deleteMany({ where: { id: { in: caseIds } } });
  }

  if (vehicleIds.length > 0) {
    await db.vehicle.deleteMany({ where: { id: { in: vehicleIds } } });
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
