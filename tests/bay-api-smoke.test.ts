import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Role } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { GET as listBays, POST as createBay } from "@/app/api/bays/route";
import {
  GET as getBay,
  PATCH as updateBay,
  DELETE as deleteBay,
} from "@/app/api/bays/[id]/route";

const csrfToken = "bay-api-smoke-csrf";

type TestSession = {
  userId: string;
  sessionId: string;
};

type BayPayload = {
  bay: {
    id: string;
    name: string;
    description: string | null;
    active: boolean;
    sortOrder: number;
  };
};

async function main() {
  const suffix = randomUUID();
  const sessions: TestSession[] = [];
  const bayIds: string[] = [];

  try {
    const admin = await createTestSession(Role.ADMIN, `admin-${suffix}`);
    const rep = await createTestSession(Role.SALES_REP, `rep-${suffix}`); // someone without service write permissions
    sessions.push(admin, rep);

    // 1. Create a bay
    const createResponse = await createBay(
      jsonRequest("http://homebase.local/api/bays", "POST", admin.sessionId, {
        name: "Test Bay 1",
        description: "Primary smoke test bay",
        active: true,
        sortOrder: 10,
      }),
    );
    await expectStatus(createResponse, 201, "create bay");
    const createBody = await readJson<BayPayload>(createResponse);
    bayIds.push(createBody.bay.id);
    assert.equal(createBody.bay.name, "Test Bay 1");
    assert.equal(createBody.bay.sortOrder, 10);

    // 2. Reject unauthorized creation
    const unauthorizedCreate = await createBay(
      jsonRequest("http://homebase.local/api/bays", "POST", rep.sessionId, {
        name: "Reps Cannot Create Bays",
      }),
    );
    await expectStatus(unauthorizedCreate, 403, "reps cannot create bays");

    // 3. List bays
    const listResponse = await listBays(
      authedRequest("http://homebase.local/api/bays", "GET", admin.sessionId),
    );
    await expectStatus(listResponse, 200, "list bays");
    const listBody = await readJson<{ bays: Array<BayPayload["bay"]> }>(listResponse);
    const listedBay = listBody.bays.find((b) => b.id === createBody.bay.id);
    assert.ok(listedBay, "new bay should be in the list");

    // 4. Get specific bay
    const getResponse = await getBay(
      authedRequest(`http://homebase.local/api/bays/${createBody.bay.id}`, "GET", admin.sessionId),
      routeContext(createBody.bay.id),
    );
    await expectStatus(getResponse, 200, "get bay");
    const getBody = await readJson<BayPayload>(getResponse);
    assert.equal(getBody.bay.name, "Test Bay 1");

    // 5. Update bay
    const patchResponse = await updateBay(
      jsonRequest(`http://homebase.local/api/bays/${createBody.bay.id}`, "PATCH", admin.sessionId, {
        name: "Updated Test Bay",
        sortOrder: 20,
      }),
      routeContext(createBody.bay.id),
    );
    await expectStatus(patchResponse, 200, "update bay");
    const patchBody = await readJson<BayPayload>(patchResponse);
    assert.equal(patchBody.bay.name, "Updated Test Bay");
    assert.equal(patchBody.bay.sortOrder, 20);

    // 6. Delete bay
    const deleteResponse = await deleteBay(
      authedRequest(`http://homebase.local/api/bays/${createBody.bay.id}`, "DELETE", admin.sessionId),
      routeContext(createBody.bay.id),
    );
    await expectStatus(deleteResponse, 200, "delete bay");

    // 7. Verify soft delete hides bay
    const getDeletedResponse = await getBay(
      authedRequest(`http://homebase.local/api/bays/${createBody.bay.id}`, "GET", admin.sessionId),
      routeContext(createBody.bay.id),
    );
    await expectStatus(getDeletedResponse, 404, "deleted bay should be hidden");

    // 8. Verify audit logs
    await assertAuditRows([
      ["bay.create", "Bay", createBody.bay.id],
      ["bay.update", "Bay", createBody.bay.id],
      ["bay.delete", "Bay", createBody.bay.id],
    ]);

    console.log("Bay API smoke test: OK");
  } finally {
    await cleanup({ sessions, bayIds });
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
    "user-agent": "bay-api-smoke-test",
    "x-forwarded-for": "127.0.0.1",
  };
}

async function createTestSession(role: Role, label: string): Promise<TestSession> {
  const user = await db.user.create({
    data: {
      email: `bay-api-${label}@example.test`,
      passwordHash: "not-used",
      role,
    },
  });
  const sessionId = `bay-api-${randomUUID()}`;

  await db.session.create({
    data: {
      id: sessionId,
      userId: user.id,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      ipAddress: "127.0.0.1",
      userAgent: "bay-api-smoke-test",
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
  bayIds,
}: {
  sessions: TestSession[];
  bayIds: string[];
}) {
  if (bayIds.length > 0) {
    await db.auditLog.deleteMany({ where: { entityId: { in: bayIds } } });
    await db.bay.deleteMany({ where: { id: { in: bayIds } } });
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
