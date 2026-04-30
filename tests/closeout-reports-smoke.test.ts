import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { subDays } from "date-fns";
import { GET as exportCloseoutReport } from "@/app/api/reports/closeout/export/route";
import { Role } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getCloseoutReport } from "@/lib/reports/closeout";

const csrfToken = "closeout-report-csrf";

async function main() {
  const suffix = randomUUID().slice(0, 8).toUpperCase();
  const ids = {
    users: [] as string[],
    sessions: [] as string[],
    customers: [] as string[],
    vehicles: [] as string[],
    workOrders: [] as string[],
    estimates: [] as string[],
    changeOrders: [] as string[],
    warrantyClaims: [] as string[],
  };

  try {
    const customer = await db.customer.create({
      data: {
        displayName: `Closeout Report Customer ${suffix}`,
      },
    });
    ids.customers.push(customer.id);

    const vehicle = await db.vehicle.create({
      data: {
        customerId: customer.id,
        year: 2024,
        make: "Peterbilt",
        model: "579",
        unitNumber: `CLO-${suffix}`,
      },
    });
    ids.vehicles.push(vehicle.id);

    const readyToBillWorkOrder = await db.workOrder.create({
      data: {
        workOrderNumber: `WO-CLO-${suffix}-RTB`,
        customerId: customer.id,
        vehicleId: vehicle.id,
        status: "READY_TO_BILL",
        priority: "NORMAL",
        title: "Ready to bill closeout",
        openedAt: subDays(new Date(), 4),
        lineItems: {
          create: [
            {
              lineType: "LABOR",
              status: "COMPLETE",
              description: "Closeout labor",
              quantity: 5,
              unitPrice: 200,
              lineTotal: 1000,
              taxable: false,
            },
            {
              lineType: "PART",
              status: "COMPLETE",
              description: "Closeout part",
              quantity: 2,
              unitPrice: 150,
              lineTotal: 300,
              taxable: true,
            },
          ],
        },
      },
    });
    ids.workOrders.push(readyToBillWorkOrder.id);

    const approvedEstimate = await db.estimate.create({
      data: {
        estimateNumber: `EST-CLO-${suffix}`,
        customerId: customer.id,
        vehicleId: vehicle.id,
        status: "APPROVED",
        title: `Closeout approved estimate ${suffix}`,
        subtotal: 2000,
        taxTotal: 0,
        total: 2000,
        approvedAt: subDays(new Date(), 3),
      },
    });
    ids.estimates.push(approvedEstimate.id);

    const approvedChangeOrder = await db.changeOrder.create({
      data: {
        changeOrderNumber: `CO-CLO-${suffix}`,
        workOrderId: readyToBillWorkOrder.id,
        status: "APPROVED",
        title: `Closeout approved change order ${suffix}`,
        subtotal: 500,
        taxTotal: 0,
        total: 500,
        approvedAt: subDays(new Date(), 2),
      },
    });
    ids.changeOrders.push(approvedChangeOrder.id);

    const recoveredClaim = await db.warrantyClaim.create({
      data: {
        workOrderId: readyToBillWorkOrder.id,
        status: "RECOVERED",
        title: `Closeout recovered claim ${suffix}`,
        claimNumber: `WC-CLO-${suffix}`,
        recoveryAmount: 750,
        resolvedAt: subDays(new Date(), 10),
      },
    });
    const openClaim = await db.warrantyClaim.create({
      data: {
        workOrderId: readyToBillWorkOrder.id,
        status: "SUBMITTED",
        title: `Closeout submitted claim ${suffix}`,
        claimNumber: `WC-CLO-SUB-${suffix}`,
        recoveryAmount: 400,
        submittedAt: subDays(new Date(), 1),
      },
    });
    ids.warrantyClaims.push(recoveredClaim.id, openClaim.id);

    const report = await getCloseoutReport();

    assert.ok(
      report.readyToBillRows.some((row) => row.label === readyToBillWorkOrder.workOrderNumber),
      "ready-to-bill rows should include the seeded work order",
    );

    assert.ok(
      report.approvedEstimateRows.some((row) => row.label === approvedEstimate.estimateNumber),
      "approved estimate rows should include the seeded estimate",
    );

    assert.ok(
      report.approvedChangeOrderRows.some(
        (row) => row.label === approvedChangeOrder.changeOrderNumber,
      ),
      "approved change-order rows should include the seeded change order",
    );

    assert.ok(
      report.warrantyRows.some((row) => row.label === recoveredClaim.claimNumber),
      "warranty rows should include the seeded recovered claim",
    );

    const openExposure = report.warrantyMetrics.find((m) => m.label === "Open exposure");
    assert.ok(openExposure, "open exposure metric should exist");

    const user = await db.user.create({
      data: {
        email: `closeout-report-viewer-${suffix}@example.test`,
        passwordHash: "not-used",
        role: Role.VIEWER,
      },
    });
    ids.users.push(user.id);

    const sessionId = `closeout-report-smoke-${randomUUID()}`;
    await db.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        ipAddress: "127.0.0.1",
        userAgent: "closeout-report-smoke",
      },
    });
    ids.sessions.push(sessionId);

    const anonResponse = await exportCloseoutReport(
      new Request("http://homebase.local/api/reports/closeout/export", { method: "GET" }),
    );
    assert.equal(anonResponse.status, 401, "unauthenticated closeout export should 401");

    const authedResponse = await exportCloseoutReport(
      new Request("http://homebase.local/api/reports/closeout/export", {
        method: "GET",
        headers: {
          cookie: `hb_session=${sessionId}; hb_csrf=${csrfToken}`,
          "x-csrf-token": csrfToken,
          "user-agent": "closeout-report-smoke",
          "x-forwarded-for": "127.0.0.1",
        },
      }),
    );
    assert.equal(authedResponse.status, 200, "authenticated closeout export should succeed");
    assert.match(
      authedResponse.headers.get("content-type") ?? "",
      /text\/csv/,
      "closeout export response should be text/csv",
    );
    const disposition = authedResponse.headers.get("content-disposition") ?? "";
    assert.match(
      disposition,
      /homebase-financial-closeout-\d{8}-\d{4}\.csv/,
      "closeout export filename should match pattern",
    );
    const body = await authedResponse.text();
    assert.ok(body.includes("Ready-to-Bill Metrics"), "body should include ready-to-bill metrics section");
    assert.ok(body.includes("Approval Metrics"), "body should include approval metrics section");
    assert.ok(
      body.includes("Warranty Recovery Metrics"),
      "body should include warranty recovery metrics section",
    );

    console.log("Closeout reports smoke test: OK");
  } finally {
    await cleanup(ids);
  }
}

async function cleanup(ids: {
  users: string[];
  sessions: string[];
  customers: string[];
  vehicles: string[];
  workOrders: string[];
  estimates: string[];
  changeOrders: string[];
  warrantyClaims: string[];
}) {
  if (ids.warrantyClaims.length > 0) {
    await db.warrantyClaim.deleteMany({ where: { id: { in: ids.warrantyClaims } } });
  }
  if (ids.changeOrders.length > 0) {
    await db.changeOrder.deleteMany({ where: { id: { in: ids.changeOrders } } });
  }
  if (ids.estimates.length > 0) {
    await db.estimate.deleteMany({ where: { id: { in: ids.estimates } } });
  }
  if (ids.workOrders.length > 0) {
    await db.workOrder.deleteMany({ where: { id: { in: ids.workOrders } } });
  }
  if (ids.vehicles.length > 0) {
    await db.vehicle.deleteMany({ where: { id: { in: ids.vehicles } } });
  }
  if (ids.customers.length > 0) {
    await db.customer.deleteMany({ where: { id: { in: ids.customers } } });
  }
  if (ids.sessions.length > 0) {
    await db.session.deleteMany({ where: { id: { in: ids.sessions } } });
  }
  if (ids.users.length > 0) {
    await db.user.deleteMany({ where: { id: { in: ids.users } } });
  }
  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
