import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Role } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { GET as listWorkOrders, POST as createWorkOrder } from "@/app/api/work-orders/route";
import {
  DELETE as deleteWorkOrder,
  GET as getWorkOrder,
  PATCH as updateWorkOrder,
} from "@/app/api/work-orders/[id]/route";
import {
  GET as listWorkOrderLines,
  POST as createWorkOrderLine,
} from "@/app/api/work-orders/[id]/line-items/route";
import {
  DELETE as deleteWorkOrderLine,
  PATCH as updateWorkOrderLine,
} from "@/app/api/work-order-line-items/[id]/route";

const csrfToken = "work-order-api-smoke-csrf";

type TestSession = {
  userId: string;
  sessionId: string;
};

type WorkOrderPayload = {
  workOrder: {
    id: string;
    workOrderNumber: string;
    title: string;
    status: string;
    priority: string;
    deletedAt: string | null;
    customerId: string;
    vehicleId: string | null;
    lineItems?: Array<{ id: string; lineTotal: string | number }>;
    statusHistory?: Array<{ toStatus: string }>;
  };
};

type WorkOrderLinePayload = {
  lineItem: {
    id: string;
    description: string;
    lineType: string;
    status: string;
    quantity: string | number;
    unitPrice: string | number;
    lineTotal: string | number;
    deletedAt: string | null;
  };
};

async function main() {
  const suffix = randomUUID();
  const sessions: TestSession[] = [];
  const customerIds: string[] = [];
  const vehicleIds: string[] = [];
  const workOrderIds: string[] = [];

  try {
    const serviceWriter = await createTestSession(Role.SERVICE_WRITER, `writer-${suffix}`);
    const viewer = await createTestSession(Role.VIEWER, `viewer-${suffix}`);
    sessions.push(serviceWriter, viewer);

    const customer = await db.customer.create({
      data: {
        displayName: `WO Smoke Customer ${suffix}`,
        email: `wo-${suffix}@example.test`,
      },
    });
    customerIds.push(customer.id);

    const vehicle = await db.vehicle.create({
      data: {
        customerId: customer.id,
        year: 2024,
        make: "Freightliner",
        model: "M2",
        unitNumber: `WO-${suffix.slice(0, 6)}`,
        currentMileage: 12000,
      },
    });
    vehicleIds.push(vehicle.id);

    const unauthenticatedCreate = await createWorkOrder(
      jsonRequest("http://homebase.local/api/work-orders", "POST", null, {
        customerId: customer.id,
        title: "Blocked work order",
      }),
    );
    await expectStatus(unauthenticatedCreate, 401, "unauthenticated work order create");

    const readOnlyCreate = await createWorkOrder(
      jsonRequest("http://homebase.local/api/work-orders", "POST", viewer.sessionId, {
        customerId: customer.id,
        title: "Blocked work order",
      }),
    );
    await expectStatus(readOnlyCreate, 403, "read-only work order create");

    const badInitialStatus = await createWorkOrder(
      jsonRequest("http://homebase.local/api/work-orders", "POST", serviceWriter.sessionId, {
        customerId: customer.id,
        title: "Wrong start",
        status: "IN_PROGRESS",
      }),
    );
    await expectStatus(badInitialStatus, 400, "work order create must start open");

    const createResponse = await createWorkOrder(
      jsonRequest("http://homebase.local/api/work-orders", "POST", serviceWriter.sessionId, {
        customerId: customer.id,
        vehicleId: vehicle.id,
        assignedTechUserId: serviceWriter.userId,
        priority: "HIGH",
        title: "Diagnose intermittent lift fault",
        complaint: "Lift cycles slowly after long idle.",
        odometerIn: 12000,
        promisedAt: "2026-04-25T00:00:00.000Z",
      }),
    );
    await expectStatus(createResponse, 201, "work order create");
    const created = await readJson<WorkOrderPayload>(createResponse);
    workOrderIds.push(created.workOrder.id);
    assert.match(created.workOrder.workOrderNumber, /^WO-\d{6}-\d{4}$/);
    assert.equal(created.workOrder.status, "OPEN");
    assert.equal(created.workOrder.priority, "HIGH");

    const listResponse = await listWorkOrders(
      authedRequest(
        `http://homebase.local/api/work-orders?q=${encodeURIComponent("lift fault")}&status=OPEN&customerId=${customer.id}`,
        "GET",
        serviceWriter.sessionId,
      ),
    );
    await expectStatus(listResponse, 200, "work order list");
    const listed = await readJson<{ workOrders: Array<{ id: string }> }>(listResponse);
    assert.ok(listed.workOrders.some((workOrder) => workOrder.id === created.workOrder.id));

    const detailResponse = await getWorkOrder(
      authedRequest(
        `http://homebase.local/api/work-orders/${created.workOrder.id}`,
        "GET",
        serviceWriter.sessionId,
      ),
      routeContext(created.workOrder.id),
    );
    await expectStatus(detailResponse, 200, "work order detail");
    const detail = await readJson<WorkOrderPayload>(detailResponse);
    assert.equal(detail.workOrder.statusHistory?.[0]?.toStatus, "OPEN");

    const lineResponse = await createWorkOrderLine(
      jsonRequest(
        `http://homebase.local/api/work-orders/${created.workOrder.id}/line-items`,
        "POST",
        serviceWriter.sessionId,
        {
          lineType: "LABOR",
          description: "Diagnostic labor",
          quantity: 2,
          unitPrice: 145,
          taxable: false,
        },
      ),
      routeContext(created.workOrder.id),
    );
    await expectStatus(lineResponse, 201, "work order line create");
    const line = await readJson<WorkOrderLinePayload>(lineResponse);
    assert.equal(Number(line.lineItem.lineTotal), 290);

    const updateLineResponse = await updateWorkOrderLine(
      jsonRequest(
        `http://homebase.local/api/work-order-line-items/${line.lineItem.id}`,
        "PATCH",
        serviceWriter.sessionId,
        { quantity: 3, status: "APPROVED" },
      ),
      routeContext(line.lineItem.id),
    );
    await expectStatus(updateLineResponse, 200, "work order line update");
    const updatedLine = await readJson<WorkOrderLinePayload>(updateLineResponse);
    assert.equal(Number(updatedLine.lineItem.lineTotal), 435);
    assert.equal(updatedLine.lineItem.status, "APPROVED");

    const listLinesResponse = await listWorkOrderLines(
      authedRequest(
        `http://homebase.local/api/work-orders/${created.workOrder.id}/line-items`,
        "GET",
        serviceWriter.sessionId,
      ),
      routeContext(created.workOrder.id),
    );
    await expectStatus(listLinesResponse, 200, "line list");
    const listedLines = await readJson<{ lineItems: Array<{ id: string }> }>(listLinesResponse);
    assert.ok(listedLines.lineItems.some((item) => item.id === line.lineItem.id));

    const updateResponse = await updateWorkOrder(
      jsonRequest(
        `http://homebase.local/api/work-orders/${created.workOrder.id}`,
        "PATCH",
        serviceWriter.sessionId,
        {
          title: "Diagnose and repair lift fault",
          priority: "URGENT",
          status: "CLOSED",
          odometerOut: 12025,
        },
      ),
      routeContext(created.workOrder.id),
    );
    await expectStatus(updateResponse, 200, "work order update");
    const updated = await readJson<WorkOrderPayload>(updateResponse);
    assert.equal(updated.workOrder.title, "Diagnose and repair lift fault");
    assert.equal(updated.workOrder.priority, "URGENT");
    assert.equal(updated.workOrder.status, "OPEN", "standard PATCH must not change lifecycle status");

    const deleteLineResponse = await deleteWorkOrderLine(
      authedRequest(
        `http://homebase.local/api/work-order-line-items/${line.lineItem.id}`,
        "DELETE",
        serviceWriter.sessionId,
      ),
      routeContext(line.lineItem.id),
    );
    await expectStatus(deleteLineResponse, 200, "work order line delete");
    const deletedLine = await readJson<WorkOrderLinePayload>(deleteLineResponse);
    assert.ok(deletedLine.lineItem.deletedAt);

    const deleteResponse = await deleteWorkOrder(
      authedRequest(
        `http://homebase.local/api/work-orders/${created.workOrder.id}`,
        "DELETE",
        serviceWriter.sessionId,
      ),
      routeContext(created.workOrder.id),
    );
    await expectStatus(deleteResponse, 200, "work order delete");
    const deleted = await readJson<WorkOrderPayload>(deleteResponse);
    assert.ok(deleted.workOrder.deletedAt);

    const getDeletedResponse = await getWorkOrder(
      authedRequest(
        `http://homebase.local/api/work-orders/${created.workOrder.id}`,
        "GET",
        serviceWriter.sessionId,
      ),
      routeContext(created.workOrder.id),
    );
    await expectStatus(getDeletedResponse, 404, "deleted work order detail");

    await assertAuditRows([
      ["work_order.create", "WorkOrder", created.workOrder.id],
      ["work_order.update", "WorkOrder", created.workOrder.id],
      ["work_order.delete", "WorkOrder", created.workOrder.id],
      ["work_order.line_item.create", "WorkOrder", created.workOrder.id],
      ["work_order.line_item.update", "WorkOrder", created.workOrder.id],
      ["work_order.line_item.delete", "WorkOrder", created.workOrder.id],
    ]);

    console.log("Work Order API smoke test: OK");
  } finally {
    await cleanup({ sessions, customerIds, vehicleIds, workOrderIds });
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
    "user-agent": "work-order-api-smoke-test",
    "x-forwarded-for": "127.0.0.1",
  };
}

async function createTestSession(role: Role, label: string): Promise<TestSession> {
  const user = await db.user.create({
    data: {
      email: `work-order-api-${label}@example.test`,
      passwordHash: "not-used",
      role,
    },
  });
  const sessionId = `work-order-api-${randomUUID()}`;

  await db.session.create({
    data: {
      id: sessionId,
      userId: user.id,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      ipAddress: "127.0.0.1",
      userAgent: "work-order-api-smoke-test",
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
