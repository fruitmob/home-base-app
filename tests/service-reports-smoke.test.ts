import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { subDays, subHours } from "date-fns";
import { Role } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getServiceOperationsReport } from "@/lib/reports/service";

async function main() {
  const suffix = randomUUID().slice(0, 8).toUpperCase();
  const ids = {
    users: [] as string[],
    customers: [] as string[],
    vehicles: [] as string[],
    workOrders: [] as string[],
    estimates: [] as string[],
    timeEntries: [] as string[],
    inspections: [] as string[],
    claims: [] as string[],
  };

  try {
    const techA = await createUser(Role.TECH, `service-report-tech-a-${suffix}`);
    const techB = await createUser(Role.TECH, `service-report-tech-b-${suffix}`);
    ids.users.push(techA.id, techB.id);

    const customer = await db.customer.create({
      data: {
        displayName: `Service Report Fleet ${suffix}`,
      },
    });
    ids.customers.push(customer.id);

    const vehicle = await db.vehicle.create({
      data: {
        customerId: customer.id,
        year: 2025,
        make: "Freightliner",
        model: "M2",
        unitNumber: `SR-${suffix}`,
      },
    });
    ids.vehicles.push(vehicle.id);

    const activeOpen = await db.workOrder.create({
      data: {
        workOrderNumber: `WO-SVC-${suffix}-OPEN`,
        customerId: customer.id,
        vehicleId: vehicle.id,
        assignedTechUserId: techA.id,
        status: "OPEN",
        priority: "HIGH",
        title: "Aging open work order",
        openedAt: subDays(new Date(), 10),
        statusHistory: {
          create: {
            fromStatus: null,
            toStatus: "OPEN",
            createdAt: subDays(new Date(), 10),
          },
        },
      },
    });

    const activeHold = await db.workOrder.create({
      data: {
        workOrderNumber: `WO-SVC-${suffix}-HOLD`,
        customerId: customer.id,
        status: "ON_HOLD_PARTS",
        priority: "NORMAL",
        title: "Hold for parts",
        openedAt: subDays(new Date(), 16),
        statusHistory: {
          create: [
            {
              fromStatus: null,
              toStatus: "OPEN",
              createdAt: subDays(new Date(), 16),
            },
            {
              fromStatus: "OPEN",
              toStatus: "ON_HOLD_PARTS",
              createdAt: subDays(new Date(), 14),
            },
          ],
        },
      },
    });

    const qcWorkOrder = await db.workOrder.create({
      data: {
        workOrderNumber: `WO-SVC-${suffix}-QC`,
        customerId: customer.id,
        vehicleId: vehicle.id,
        status: "QC",
        priority: "NORMAL",
        title: "Quality queue work order",
        openedAt: subDays(new Date(), 3),
        statusHistory: {
          create: [
            {
              fromStatus: null,
              toStatus: "OPEN",
              createdAt: subDays(new Date(), 3),
            },
            {
              fromStatus: "OPEN",
              toStatus: "IN_PROGRESS",
              createdAt: subDays(new Date(), 2),
            },
            {
              fromStatus: "IN_PROGRESS",
              toStatus: "QC",
              createdAt: subDays(new Date(), 1),
            },
          ],
        },
      },
    });

    const closedWorkOrder = await db.workOrder.create({
      data: {
        workOrderNumber: `WO-SVC-${suffix}-CLOSED`,
        customerId: customer.id,
        vehicleId: vehicle.id,
        assignedTechUserId: techB.id,
        status: "CLOSED",
        priority: "NORMAL",
        title: "Converted estimate closeout",
        openedAt: subDays(new Date(), 5),
        closedAt: new Date(),
        lineItems: {
          create: [
            {
              lineType: "LABOR",
              status: "COMPLETE",
              description: "Diagnostic labor",
              quantity: 4,
              unitPrice: 150,
              lineTotal: 600,
              taxable: false,
            },
            {
              lineType: "PART",
              status: "COMPLETE",
              description: "Replacement rotor",
              quantity: 2,
              unitPrice: 300,
              lineTotal: 600,
              taxable: true,
            },
          ],
        },
        statusHistory: {
          create: [
            {
              fromStatus: null,
              toStatus: "OPEN",
              createdAt: subDays(new Date(), 5),
            },
            {
              fromStatus: "OPEN",
              toStatus: "IN_PROGRESS",
              createdAt: subDays(new Date(), 4),
            },
            {
              fromStatus: "IN_PROGRESS",
              toStatus: "QC",
              createdAt: subDays(new Date(), 1),
            },
            {
              fromStatus: "QC",
              toStatus: "READY_TO_BILL",
              createdAt: subHours(new Date(), 6),
            },
            {
              fromStatus: "READY_TO_BILL",
              toStatus: "CLOSED",
              createdAt: new Date(),
            },
          ],
        },
      },
    });

    ids.workOrders.push(activeOpen.id, activeHold.id, qcWorkOrder.id, closedWorkOrder.id);

    const estimate = await db.estimate.create({
      data: {
        estimateNumber: `EST-SVC-${suffix}`,
        customerId: customer.id,
        vehicleId: vehicle.id,
        convertedWorkOrderId: closedWorkOrder.id,
        status: "CONVERTED",
        title: "Converted estimate closeout",
        subtotal: 1000,
        taxTotal: 0,
        total: 1000,
      },
    });
    ids.estimates.push(estimate.id);

    const timeEntryA = await db.timeEntry.create({
      data: {
        workOrderId: activeOpen.id,
        userId: techA.id,
        status: "APPROVED",
        durationMinutes: 360,
        billableMinutes: 300,
        goodwillMinutes: 60,
        startedAt: subDays(new Date(), 3),
        endedAt: subDays(new Date(), 3),
        approvedAt: subDays(new Date(), 2),
      },
    });
    const timeEntryB = await db.timeEntry.create({
      data: {
        workOrderId: closedWorkOrder.id,
        userId: techB.id,
        status: "APPROVED",
        durationMinutes: 180,
        billableMinutes: 180,
        goodwillMinutes: 0,
        startedAt: subDays(new Date(), 2),
        endedAt: subDays(new Date(), 2),
        approvedAt: subDays(new Date(), 1),
      },
    });
    ids.timeEntries.push(timeEntryA.id, timeEntryB.id);

    const draftInspection = await db.arrivalInspection.create({
      data: {
        customerId: customer.id,
        vehicleId: vehicle.id,
        status: "DRAFT",
        type: "ARRIVAL",
        createdAt: subDays(new Date(), 2),
      },
    });
    const completedInspection = await db.arrivalInspection.create({
      data: {
        customerId: customer.id,
        vehicleId: vehicle.id,
        status: "COMPLETE",
        type: "PDI",
        performedAt: subDays(new Date(), 1),
      },
    });
    ids.inspections.push(draftInspection.id, completedInspection.id);

    const claim = await db.warrantyClaim.create({
      data: {
        workOrderId: qcWorkOrder.id,
        status: "OPEN",
        title: `QC risk claim ${suffix}`,
      },
    });
    ids.claims.push(claim.id);

    const report = await getServiceOperationsReport();

    assertMetricAtLeast(report.heroMetrics, "8+ day jobs", 2);
    assertMetricAtLeast(report.wipMetrics, "On hold", 1);
    assertMetricAtLeast(report.actualEstimateMetrics, "Converted work orders", 1);
    assertMetricAtLeast(report.qcMetrics, "QC queue", 1);
    assertMetricAtLeast(report.qcMetrics, "Draft inspections", 1);
    assertMetricAtLeast(report.qcMetrics, "Completed inspections", 1);
    assertMetricAtLeast(report.qcMetrics, "Open warranty risk", 1);

    assert.ok(
      report.oldestRows.some((row) => row.label === activeHold.workOrderNumber),
      "oldest active work rows should include the seeded hold work order",
    );

    const varianceRow = report.actualEstimateRows.find((row) =>
      row.label.includes(closedWorkOrder.workOrderNumber) && row.label.includes(estimate.estimateNumber),
    );
    assert.ok(varianceRow, "actual vs estimate rows should include the converted work order");
    assert.equal(varianceRow?.value, "+$200.00");

    const cycleRow = report.cycleRecentRows.find((row) => row.label === closedWorkOrder.workOrderNumber);
    assert.ok(cycleRow, "cycle rows should include the closed work order");
    assert.ok(cycleRow?.value.startsWith("5"), `expected seeded cycle time near 5 days, got ${cycleRow?.value}`);

    assert.ok(
      report.cycleStageRows.some((row) => row.label === "Ready To Bill"),
      "cycle stage rows should include READY_TO_BILL dwell",
    );

    assert.ok(
      report.technicianRows.some((row) => row.label.includes(techA.email)),
      "technician rows should include seeded tech A",
    );
    assert.ok(
      report.technicianRows.some((row) => row.label.includes(techB.email)),
      "technician rows should include seeded tech B",
    );

    assert.ok(
      report.qcRows.some((row) => row.label === qcWorkOrder.workOrderNumber),
      "QC rows should include the seeded QC work order",
    );
    assert.ok(
      report.inspectionRows.some((row) => row.href === `/inspections/${draftInspection.id}`),
      "inspection rows should include the seeded draft inspection",
    );

    console.log("Service reports smoke test: OK");
  } finally {
    await cleanup(ids);
  }
}

function assertMetricAtLeast(
  metrics: Array<{ label: string; value: string }>,
  label: string,
  expectedMinimum: number,
) {
  const metric = metrics.find((entry) => entry.label === label);
  assert.ok(metric, `Metric "${label}" should exist`);
  const numeric = Number(metric.value.replace(/[$,%+,d,h,]/g, ""));
  assert.ok(numeric >= expectedMinimum, `${label} should be at least ${expectedMinimum}, got ${metric.value}`);
}

async function createUser(role: Role, label: string) {
  return db.user.create({
    data: {
      email: `${label}@example.test`,
      passwordHash: "not-used",
      role,
    },
    select: {
      id: true,
      email: true,
      role: true,
    },
  });
}

async function cleanup(ids: {
  users: string[];
  customers: string[];
  vehicles: string[];
  workOrders: string[];
  estimates: string[];
  timeEntries: string[];
  inspections: string[];
  claims: string[];
}) {
  if (ids.claims.length > 0) {
    await db.warrantyClaim.deleteMany({ where: { id: { in: ids.claims } } });
  }

  if (ids.inspections.length > 0) {
    await db.arrivalInspection.deleteMany({ where: { id: { in: ids.inspections } } });
  }

  if (ids.timeEntries.length > 0) {
    await db.timeEntry.deleteMany({ where: { id: { in: ids.timeEntries } } });
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

  if (ids.users.length > 0) {
    await db.user.deleteMany({ where: { id: { in: ids.users } } });
  }

  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
