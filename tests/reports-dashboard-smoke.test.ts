import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { startOfWeek, subDays } from "date-fns";
import { Role, WorkOrderStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getDashboardSnapshot, getReportOverviewCards, type DashboardMetric } from "@/lib/reports/dashboard";

async function main() {
  const suffix = randomUUID().slice(0, 8);
  const ids = {
    users: [] as string[],
    customers: [] as string[],
    vehicles: [] as string[],
    opportunities: [] as string[],
    activities: [] as string[],
    quotes: [] as string[],
    workOrders: [] as string[],
    timeEntries: [] as string[],
    parts: [] as string[],
    partTransactions: [] as string[],
    inspections: [] as string[],
    claims: [] as string[],
  };

  try {
    const owner = await createUser(Role.OWNER, `reports-owner-${suffix}`);
    const tech = await createUser(Role.TECH, `reports-tech-${suffix}`);
    const otherTech = await createUser(Role.TECH, `reports-tech-peer-${suffix}`);
    const salesRep = await createUser(Role.SALES_REP, `reports-sales-${suffix}`);
    const otherSalesRep = await createUser(Role.SALES_REP, `reports-sales-peer-${suffix}`);
    ids.users.push(owner.id, tech.id, otherTech.id, salesRep.id, otherSalesRep.id);

    const customer = await db.customer.create({
      data: {
        displayName: `Reports Smoke Fleet ${suffix}`,
        email: `reports-${suffix}@example.test`,
      },
    });
    ids.customers.push(customer.id);

    const vehicle = await db.vehicle.create({
      data: {
        customerId: customer.id,
        year: 2024,
        make: "Freightliner",
        model: "M2",
        unitNumber: `RPT-${suffix.toUpperCase()}`,
      },
    });
    ids.vehicles.push(vehicle.id);

    const openOpportunity = await db.opportunity.create({
      data: {
        customerId: customer.id,
        ownerUserId: salesRep.id,
        name: `Open pipeline ${suffix}`,
        stage: "NEW",
        amount: 5200,
      },
    });
    const wonOpportunity = await db.opportunity.create({
      data: {
        customerId: customer.id,
        ownerUserId: salesRep.id,
        name: `Won revenue ${suffix}`,
        stage: "WON",
        amount: 1500,
        closedAt: new Date(),
      },
    });
    const teamOpportunity = await db.opportunity.create({
      data: {
        customerId: customer.id,
        ownerUserId: otherSalesRep.id,
        name: `Team pipeline ${suffix}`,
        stage: "QUALIFIED",
        amount: 9900,
      },
    });
    ids.opportunities.push(openOpportunity.id, wonOpportunity.id, teamOpportunity.id);

    const dueActivity = await db.activity.create({
      data: {
        ownerUserId: salesRep.id,
        opportunityId: openOpportunity.id,
        type: "TASK",
        status: "OPEN",
        subject: `Follow up ${suffix}`,
        dueAt: subDays(new Date(), 1),
      },
    });
    const peerActivity = await db.activity.create({
      data: {
        ownerUserId: otherSalesRep.id,
        opportunityId: teamOpportunity.id,
        type: "TASK",
        status: "OPEN",
        subject: `Peer follow up ${suffix}`,
        dueAt: subDays(new Date(), 1),
      },
    });
    ids.activities.push(dueActivity.id, peerActivity.id);

    const quote = await db.quote.create({
      data: {
        quoteNumber: `QRPT-${suffix}`,
        customerId: customer.id,
        createdByUserId: salesRep.id,
        status: "SENT",
        subtotal: 0,
        taxTotal: 0,
        total: 0,
      },
    });
    ids.quotes.push(quote.id);

    const techWorkOrder = await db.workOrder.create({
      data: {
        workOrderNumber: `WO-RPT-${suffix}-1`,
        customerId: customer.id,
        vehicleId: vehicle.id,
        assignedTechUserId: tech.id,
        status: "OPEN",
        priority: "HIGH",
        title: "Primary assigned job",
        openedAt: subDays(new Date(), 2),
      },
    });
    const unassignedWorkOrder = await db.workOrder.create({
      data: {
        workOrderNumber: `WO-RPT-${suffix}-2`,
        customerId: customer.id,
        status: "IN_PROGRESS",
        priority: "NORMAL",
        title: "Unassigned aging work",
        openedAt: subDays(new Date(), 10),
      },
    });
    const readyToBillWorkOrder = await db.workOrder.create({
      data: {
        workOrderNumber: `WO-RPT-${suffix}-3`,
        customerId: customer.id,
        assignedTechUserId: otherTech.id,
        status: "READY_TO_BILL",
        priority: "NORMAL",
        title: "Closeout ready work",
        openedAt: subDays(new Date(), 1),
      },
    });
    ids.workOrders.push(techWorkOrder.id, unassignedWorkOrder.id, readyToBillWorkOrder.id);

    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const approvedEntry = await db.timeEntry.create({
      data: {
        workOrderId: techWorkOrder.id,
        userId: tech.id,
        status: "APPROVED",
        durationMinutes: 360,
        billableMinutes: 300,
        goodwillMinutes: 60,
        startedAt: weekStart,
        endedAt: new Date(weekStart.getTime() + 6 * 60 * 60 * 1000),
        approvedAt: new Date(),
      },
    });
    const activeEntry = await db.timeEntry.create({
      data: {
        workOrderId: techWorkOrder.id,
        userId: tech.id,
        status: "DRAFT",
        active: true,
        durationMinutes: 45,
        billableMinutes: 45,
        startedAt: new Date(),
      },
    });
    const peerEntry = await db.timeEntry.create({
      data: {
        workOrderId: readyToBillWorkOrder.id,
        userId: otherTech.id,
        status: "APPROVED",
        durationMinutes: 120,
        billableMinutes: 120,
        startedAt: weekStart,
        endedAt: new Date(weekStart.getTime() + 2 * 60 * 60 * 1000),
        approvedAt: new Date(),
      },
    });
    ids.timeEntries.push(approvedEntry.id, activeEntry.id, peerEntry.id);

    const part = await db.part.create({
      data: {
        sku: `PART-RPT-${suffix}`,
        name: `Low Stock Rotor ${suffix}`,
        quantityOnHand: 2,
        quantityReserved: 1,
        reorderPoint: 5,
        unitCost: 42,
      },
    });
    ids.parts.push(part.id);

    const receiveTx = await db.partTransaction.create({
      data: {
        partId: part.id,
        type: "RECEIVE",
        quantity: 6,
      },
    });
    const issueTx = await db.partTransaction.create({
      data: {
        partId: part.id,
        workOrderId: techWorkOrder.id,
        type: "ISSUE",
        quantity: 3,
      },
    });
    ids.partTransactions.push(receiveTx.id, issueTx.id);

    const inspection = await db.arrivalInspection.create({
      data: {
        customerId: customer.id,
        vehicleId: vehicle.id,
        type: "ARRIVAL",
        status: "DRAFT",
      },
    });
    ids.inspections.push(inspection.id);

    const claim = await db.warrantyClaim.create({
      data: {
        workOrderId: readyToBillWorkOrder.id,
        status: "RECOVERED",
        title: `Recovered claim ${suffix}`,
        recoveryAmount: 750,
        resolvedAt: new Date(),
      },
    });
    ids.claims.push(claim.id);

    const ownerSnapshot = await getDashboardSnapshot(owner);
    assertCountAtLeast(ownerSnapshot.metrics, "Active WIP", 3);
    assertCountAtLeast(ownerSnapshot.metrics, "Ready to bill", 1);
    assertCurrencyAtLeast(ownerSnapshot.metrics, "Open pipeline", 15100);
    assertCountAtLeast(ownerSnapshot.metrics, "Data exceptions", 2);

    const techSnapshot = await getDashboardSnapshot(tech);
    assert.equal(findMetric(techSnapshot.metrics, "My open work"), "1");
    assert.equal(findMetric(techSnapshot.metrics, "Active timers"), "1");
    assert.equal(findMetric(techSnapshot.metrics, "Billable hours"), "5h");
    assert.equal(findMetric(techSnapshot.metrics, "Goodwill hours"), "1h");

    const salesSnapshot = await getDashboardSnapshot(salesRep);
    assert.equal(findMetric(salesSnapshot.metrics, "Open pipeline"), "$5,200.00");
    assert.equal(findMetric(salesSnapshot.metrics, "Won this month"), "$1,500.00");
    assert.equal(findMetric(salesSnapshot.metrics, "Due follow-ups"), "1");
    assert.equal(findMetric(salesSnapshot.metrics, "Sent quotes"), "1");

    const reportCards = await getReportOverviewCards();
    const serviceCard = reportCards.find((card) => card.title === "Service Operations");
    const inventoryCard = reportCards.find((card) => card.title === "Parts & Inventory");
    const qualityCard = reportCards.find((card) => card.title === "Quality & Risk");

    assert.ok(serviceCard, "service operations card should exist");
    assert.ok(inventoryCard, "parts inventory card should exist");
    assert.ok(qualityCard, "quality risk card should exist");

    assertCountAtLeast(serviceCard.metrics, "Active WIP", 3);
    assertCountAtLeast(serviceCard.metrics, "Ready to bill", 1);
    assertCountAtLeast(inventoryCard.metrics, "Low-stock parts", 1);
    assertDecimalAtLeast(inventoryCard.metrics, "Reserved quantity", 1);
    assertDecimalAtLeast(inventoryCard.metrics, "Received (30d)", 6);
    assertDecimalAtLeast(inventoryCard.metrics, "Issued (30d)", 3);
    assertCurrencyAtLeast(qualityCard.metrics, "Recovered this month", 750);
    assertCountAtLeast(qualityCard.metrics, "Data exceptions", 2);

    console.log("Reports dashboard smoke test: OK");
  } finally {
    await cleanup(ids);
  }
}

function findMetric(metrics: DashboardMetric[], label: string) {
  const metric = metrics.find((entry) => entry.label === label);
  assert.ok(metric, `Metric "${label}" should exist`);
  return metric.value;
}

function assertCountAtLeast(metrics: DashboardMetric[], label: string, expectedMinimum: number) {
  const actual = Number(findMetric(metrics, label).replaceAll(",", ""));
  assert.ok(actual >= expectedMinimum, `${label} should be at least ${expectedMinimum}, got ${actual}`);
}

function assertDecimalAtLeast(metrics: DashboardMetric[], label: string, expectedMinimum: number) {
  const actual = Number(findMetric(metrics, label).replaceAll(",", ""));
  assert.ok(actual >= expectedMinimum, `${label} should be at least ${expectedMinimum}, got ${actual}`);
}

function assertCurrencyAtLeast(metrics: DashboardMetric[], label: string, expectedMinimum: number) {
  const actual = Number(findMetric(metrics, label).replace(/[$,]/g, ""));
  assert.ok(actual >= expectedMinimum, `${label} should be at least ${expectedMinimum}, got ${actual}`);
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
  opportunities: string[];
  activities: string[];
  quotes: string[];
  workOrders: string[];
  timeEntries: string[];
  parts: string[];
  partTransactions: string[];
  inspections: string[];
  claims: string[];
}) {
  if (ids.claims.length > 0) {
    await db.warrantyClaim.deleteMany({ where: { id: { in: ids.claims } } });
  }

  if (ids.inspections.length > 0) {
    await db.arrivalInspection.deleteMany({ where: { id: { in: ids.inspections } } });
  }

  if (ids.partTransactions.length > 0) {
    await db.partTransaction.deleteMany({ where: { id: { in: ids.partTransactions } } });
  }

  if (ids.parts.length > 0) {
    await db.part.deleteMany({ where: { id: { in: ids.parts } } });
  }

  if (ids.timeEntries.length > 0) {
    await db.timeEntry.deleteMany({ where: { id: { in: ids.timeEntries } } });
  }

  if (ids.workOrders.length > 0) {
    await db.workOrder.deleteMany({ where: { id: { in: ids.workOrders } } });
  }

  if (ids.quotes.length > 0) {
    await db.quote.deleteMany({ where: { id: { in: ids.quotes } } });
  }

  if (ids.activities.length > 0) {
    await db.activity.deleteMany({ where: { id: { in: ids.activities } } });
  }

  if (ids.opportunities.length > 0) {
    await db.opportunity.deleteMany({ where: { id: { in: ids.opportunities } } });
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
