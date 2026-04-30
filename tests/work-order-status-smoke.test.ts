import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Role } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { POST as createWorkOrder } from "@/app/api/work-orders/route";
import { POST as updateWorkOrderStatus } from "@/app/api/work-orders/[id]/status/route";

const csrfToken = "wo-status-smoke-csrf";

type TestSession = {
  userId: string;
  sessionId: string;
};

async function main() {
  const suffix = randomUUID();
  const sessions: TestSession[] = [];
  const customerIds: string[] = [];
  const vehicleIds: string[] = [];
  const workOrderIds: string[] = [];

  try {
    const sw = await createTestSession(Role.SERVICE_WRITER, `sw-${suffix}`);
    sessions.push(sw);

    const customer = await db.customer.create({
      data: {
        displayName: `Status Smoke ${suffix}`,
        email: `status-${suffix}@example.test`,
      },
    });
    customerIds.push(customer.id);

    // Create WO
    const createRes = await createWorkOrder(
      jsonRequest("http://homebase.local/api/work-orders", "POST", sw.sessionId, {
        customerId: customer.id,
        title: "Status Transition Test",
      }),
    );
    await expectStatus(createRes, 201, "create WO");
    const { workOrder } = await readJson<{ workOrder: { id: string; status: string } }>(createRes);
    workOrderIds.push(workOrder.id);

    // 1. Invalid status value
    const invalidStatusRes = await updateWorkOrderStatus(
      jsonRequest(
        `http://homebase.local/api/work-orders/${workOrder.id}/status`,
        "POST",
        sw.sessionId,
        { status: "NOT_A_REAL_STATUS" },
      ),
      routeContext(workOrder.id),
    );
    await expectStatus(invalidStatusRes, 400, "invalid status");

    // 2. Invalid Transition (OPEN -> CLOSED is allowed per logic, let's try OPEN -> QC)
    // Wait, allowed OPEN is IN_PROGRESS, ON_HOLD_PARTS, ON_HOLD_DELAY
    const invalidTransitionRes = await updateWorkOrderStatus(
      jsonRequest(
        `http://homebase.local/api/work-orders/${workOrder.id}/status`,
        "POST",
        sw.sessionId,
        { status: "QC" },
      ),
      routeContext(workOrder.id),
    );
    await expectStatus(invalidTransitionRes, 400, "invalid transition");

    // 3. Valid Transition (OPEN -> IN_PROGRESS)
    const validTransitionRes = await updateWorkOrderStatus(
      jsonRequest(
        `http://homebase.local/api/work-orders/${workOrder.id}/status`,
        "POST",
        sw.sessionId,
        { status: "IN_PROGRESS" },
      ),
      routeContext(workOrder.id),
    );
    await expectStatus(validTransitionRes, 200, "valid transition to IN_PROGRESS");

    // 4. Verify history is created
    const history = await db.workOrderStatusHistory.findMany({
      where: { workOrderId: workOrder.id },
      orderBy: { createdAt: "desc" },
    });
    assert.equal(history[0].fromStatus, "OPEN");
    assert.equal(history[0].toStatus, "IN_PROGRESS");

    // 5. Active timers block closure
    // Create a time entry for this WO
    const lineItem = await db.workOrderLineItem.create({
      data: {
        workOrderId: workOrder.id,
        lineType: "LABOR",
        description: "Test line",
        lineTotal: 0,
      },
    });
    const timeEntry = await db.timeEntry.create({
      data: {
        workOrderId: workOrder.id,
        lineItemId: lineItem.id,
        userId: sw.userId,
        startedAt: new Date(),
        active: true,
      },
    });

    const jumpToReadyRes = await updateWorkOrderStatus(
      jsonRequest(
        `http://homebase.local/api/work-orders/${workOrder.id}/status`,
        "POST",
        sw.sessionId,
        { status: "READY_TO_BILL" },
      ),
      routeContext(workOrder.id),
    );
    await expectStatus(jumpToReadyRes, 200, "jump to READY_TO_BILL");

    // Now try to close (blocked by time entry)
    const blockedCloseRes = await updateWorkOrderStatus(
      jsonRequest(
        `http://homebase.local/api/work-orders/${workOrder.id}/status`,
        "POST",
        sw.sessionId,
        { status: "CLOSED" },
      ),
      routeContext(workOrder.id),
    );
    await expectStatus(blockedCloseRes, 400, "cannot close with active timer");
    const blockedBody = await readJson<{ error: string }>(blockedCloseRes);
    assert.match(blockedBody.error, /Cannot close work order with active time entries/);

    // Stop timer, then close
    await db.timeEntry.update({
      where: { id: timeEntry.id },
      data: { endedAt: new Date(), active: false },
    });

    const allowedCloseRes = await updateWorkOrderStatus(
      jsonRequest(
        `http://homebase.local/api/work-orders/${workOrder.id}/status`,
        "POST",
        sw.sessionId,
        { status: "CLOSED" },
      ),
      routeContext(workOrder.id),
    );
    await expectStatus(allowedCloseRes, 200, "can close after timer stops");

    console.log("Work Order Status API smoke test: OK");
  } finally {
    await cleanup({ sessions, customerIds, vehicleIds, workOrderIds });
  }
}

function routeContext(id: string) {
  return { params: { id } };
}

function jsonRequest(url: string, method: string, sessionId: string | null, body: unknown) {
  return new Request(url, {
    method,
    headers: {
      ...(sessionId ? { cookie: `hb_session=${sessionId}; hb_csrf=${csrfToken}` } : {}),
      "x-csrf-token": csrfToken,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function createTestSession(role: Role, label: string): Promise<TestSession> {
  const user = await db.user.create({
    data: {
      email: `wo-status-${label}@example.test`,
      passwordHash: "not-used",
      role,
    },
  });
  const sessionId = `wo-status-${randomUUID()}`;

  await db.session.create({
    data: {
      id: sessionId,
      userId: user.id,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      ipAddress: "127.0.0.1",
      userAgent: "wo-status-smoke",
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

async function cleanup({
  sessions,
  customerIds,
  vehicleIds,
  workOrderIds,
}: {
  sessions: TestSession[];
  customerIds: string[];
  vehicleIds: string[];
  workOrderIds: string[];
}) {
  if (workOrderIds.length > 0) {
    await db.timeEntry.deleteMany({
      where: { workOrderId: { in: workOrderIds } }
    });
    await db.workOrderLineItem.deleteMany({
      where: { workOrderId: { in: workOrderIds } }
    });
    await db.workOrderStatusHistory.deleteMany({
      where: { workOrderId: { in: workOrderIds } }
    });
    await db.auditLog.deleteMany({ where: { entityId: { in: workOrderIds } } });
    await db.workOrder.deleteMany({ where: { id: { in: workOrderIds } } });
  }

  if (vehicleIds.length > 0) {
    await db.vehicle.deleteMany({ where: { id: { in: vehicleIds } } });
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
