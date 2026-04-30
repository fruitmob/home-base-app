import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { subDays } from "date-fns";
import { Role } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { type DashboardMetric, getReportOverviewCards } from "@/lib/reports/dashboard";
import { getSalesCustomerReport } from "@/lib/reports/sales";

async function main() {
  const suffix = randomUUID().slice(0, 8).toUpperCase();
  const currentPeriod = getCurrentPeriod();
  const ids = {
    users: [] as string[],
    customers: [] as string[],
    opportunities: [] as string[],
    activities: [] as string[],
    goals: [] as string[],
    quotes: [] as string[],
    estimates: [] as string[],
    workOrders: [] as string[],
  };

  try {
    const manager = await createUser(Role.SALES_MANAGER, `sales-report-manager-${suffix}`);
    const repA = await createUser(Role.SALES_REP, `sales-report-rep-a-${suffix}`);
    const repB = await createUser(Role.SALES_REP, `sales-report-rep-b-${suffix}`);
    ids.users.push(manager.id, repA.id, repB.id);

    const customerA = await db.customer.create({
      data: {
        displayName: `Sales Report Fleet A ${suffix}`,
      },
    });
    const customerB = await db.customer.create({
      data: {
        displayName: `Sales Report Fleet B ${suffix}`,
      },
    });
    const customerC = await db.customer.create({
      data: {
        displayName: `Sales Report Service Only ${suffix}`,
      },
    });
    ids.customers.push(customerA.id, customerB.id, customerC.id);

    const openA = await db.opportunity.create({
      data: {
        customerId: customerA.id,
        ownerUserId: repA.id,
        name: `Rep A open ${suffix}`,
        stage: "NEW",
        amount: 5200,
        createdAt: subDays(new Date(), 5),
      },
    });
    const wonA = await db.opportunity.create({
      data: {
        customerId: customerA.id,
        ownerUserId: repA.id,
        name: `Rep A won ${suffix}`,
        stage: "WON",
        amount: 8000,
        createdAt: subDays(new Date(), 14),
        closedAt: new Date(),
      },
    });
    const lostA = await db.opportunity.create({
      data: {
        customerId: customerA.id,
        ownerUserId: repA.id,
        name: `Rep A lost ${suffix}`,
        stage: "LOST",
        amount: 2000,
        createdAt: subDays(new Date(), 11),
        closedAt: new Date(),
      },
    });
    const openB = await db.opportunity.create({
      data: {
        customerId: customerB.id,
        ownerUserId: repB.id,
        name: `Rep B open ${suffix}`,
        stage: "QUALIFIED",
        amount: 9000,
        createdAt: subDays(new Date(), 7),
      },
    });
    const wonB = await db.opportunity.create({
      data: {
        customerId: customerB.id,
        ownerUserId: repB.id,
        name: `Rep B won ${suffix}`,
        stage: "WON",
        amount: 4000,
        createdAt: subDays(new Date(), 10),
        closedAt: new Date(),
      },
    });
    ids.opportunities.push(openA.id, wonA.id, lostA.id, openB.id, wonB.id);

    const activityA = await db.activity.create({
      data: {
        ownerUserId: repA.id,
        opportunityId: openA.id,
        type: "TASK",
        status: "OPEN",
        subject: `Rep A follow-up ${suffix}`,
        dueAt: subDays(new Date(), 1),
      },
    });
    const activityB = await db.activity.create({
      data: {
        ownerUserId: repB.id,
        opportunityId: openB.id,
        type: "TASK",
        status: "OPEN",
        subject: `Rep B follow-up ${suffix}`,
        dueAt: subDays(new Date(), 1),
      },
    });
    ids.activities.push(activityA.id, activityB.id);

    const goalA = await db.salesGoal.create({
      data: {
        userId: repA.id,
        period: currentPeriod,
        targetAmount: 10000,
      },
    });
    const goalB = await db.salesGoal.create({
      data: {
        userId: repB.id,
        period: currentPeriod,
        targetAmount: 5000,
      },
    });
    ids.goals.push(goalA.id, goalB.id);

    const quoteA = await db.quote.create({
      data: {
        quoteNumber: `Q-SALES-${suffix}-A`,
        customerId: customerA.id,
        createdByUserId: repA.id,
        status: "ACCEPTED",
        subtotal: 2000,
        taxTotal: 0,
        total: 2000,
      },
    });
    const quoteB = await db.quote.create({
      data: {
        quoteNumber: `Q-SALES-${suffix}-B`,
        customerId: customerB.id,
        createdByUserId: repB.id,
        status: "ACCEPTED",
        subtotal: 1000,
        taxTotal: 0,
        total: 1000,
      },
    });
    ids.quotes.push(quoteA.id, quoteB.id);

    const estimateA = await db.estimate.create({
      data: {
        estimateNumber: `EST-SALES-${suffix}-A`,
        customerId: customerA.id,
        createdByUserId: repA.id,
        status: "APPROVED",
        title: `Rep A estimate ${suffix}`,
        subtotal: 1500,
        taxTotal: 0,
        total: 1500,
      },
    });
    ids.estimates.push(estimateA.id);

    const workOrderA = await db.workOrder.create({
      data: {
        workOrderNumber: `WO-SALES-${suffix}-A`,
        customerId: customerC.id,
        status: "READY_TO_BILL",
        title: `Service-only work order A ${suffix}`,
        openedAt: subDays(new Date(), 3),
        lineItems: {
          create: {
            lineType: "LABOR",
            status: "COMPLETE",
            description: "Service-only labor",
            quantity: 1,
            unitPrice: 700,
            lineTotal: 700,
            taxable: false,
          },
        },
      },
    });
    const workOrderB = await db.workOrder.create({
      data: {
        workOrderNumber: `WO-SALES-${suffix}-B`,
        customerId: customerC.id,
        status: "CLOSED",
        title: `Service-only work order B ${suffix}`,
        openedAt: subDays(new Date(), 1),
        closedAt: new Date(),
        lineItems: {
          create: {
            lineType: "LABOR",
            status: "COMPLETE",
            description: "Service-only follow-up",
            quantity: 1,
            unitPrice: 300,
            lineTotal: 300,
            taxable: false,
          },
        },
      },
    });
    ids.workOrders.push(workOrderA.id, workOrderB.id);

    const managerReport = await getSalesCustomerReport(manager);
    const repReport = await getSalesCustomerReport(repA);

    assertCurrencyAtLeast(managerReport.heroMetrics, "Open pipeline", 14200);
    assertCurrencyAtLeast(managerReport.heroMetrics, "Won this period", 12000);
    assertCurrencyAtLeast(managerReport.performanceMetrics, "Goal target", 15000);
    assertCountAtLeast(managerReport.performanceMetrics, "Overdue follow-ups", 2);
    assertCountAtLeast(managerReport.customerMetrics, "Repeat customers", 3);
    assertCountAtLeast(managerReport.customerMetrics, "2+ work orders", 1);
    assertCountAtLeast(managerReport.customerMetrics, "Pipeline customers", 2);
    assertCurrencyAtLeast(managerReport.customerMetrics, "Starter value proxy", 17500);

    assert.equal(findMetric(repReport.heroMetrics, "Open pipeline"), "$5,200.00");
    assert.equal(findMetric(repReport.heroMetrics, "Won this period"), "$8,000.00");
    assert.equal(findMetric(repReport.heroMetrics, "Goal attainment"), "80%");
    assert.equal(findMetric(repReport.performanceMetrics, "Goal target"), "$10,000.00");
    assert.equal(findMetric(repReport.performanceMetrics, "Overdue follow-ups"), "1");
    assert.equal(findMetric(repReport.customerMetrics, "Repeat customers"), "1");
    assert.equal(findMetric(repReport.customerMetrics, "Starter value proxy"), "$11,500.00");

    assert.ok(
      managerReport.stageRows.some((row) => row.label === "New"),
      "manager stage rows should include the NEW stage",
    );
    assert.ok(
      managerReport.stageRows.some((row) => row.label === "Qualified"),
      "manager stage rows should include the QUALIFIED stage",
    );
    assert.ok(
      managerReport.stageAgeRows.some((row) => row.label === "New"),
      "manager stage-age rows should include the NEW stage",
    );
    assert.ok(
      managerReport.oldestOpenRows.some((row) => row.href === `/sales/opportunities/${openA.id}`),
      "manager oldest-open rows should include rep A's open opportunity",
    );

    assert.ok(
      managerReport.performanceRows.some((row) => row.label === repA.email),
      "manager performance rows should include rep A",
    );
    assert.ok(
      managerReport.performanceRows.some((row) => row.label === repB.email),
      "manager performance rows should include rep B",
    );
    assert.ok(
      repReport.performanceRows.every((row) => row.label === repA.email),
      "rep report should only include the current rep's performance row",
    );

    assert.ok(
      repReport.customerRows.some((row) => row.label === customerA.displayName),
      "rep report should include the current rep's customer momentum row",
    );
    assert.ok(
      !repReport.customerRows.some((row) => row.label === customerB.displayName),
      "rep report should not include another rep's customer rows",
    );
    assert.ok(
      !repReport.customerRows.some((row) => row.label === customerC.displayName),
      "rep report should not include service-only customers without sales ownership",
    );

    const reportCards = await getReportOverviewCards(repA);
    const salesCard = reportCards.find((card) => card.id === "sales-pipeline");
    assert.ok(salesCard, "sales pipeline card should exist on the reports hub");
    assert.equal(findMetric(salesCard.metrics, "Open pipeline"), "$5,200.00");
    assert.equal(findMetric(salesCard.metrics, "Won this month"), "$8,000.00");
    assert.equal(findMetric(salesCard.metrics, "Due follow-ups"), "1");

    console.log("Sales reports smoke test: OK");
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

function assertCurrencyAtLeast(metrics: DashboardMetric[], label: string, expectedMinimum: number) {
  const actual = Number(findMetric(metrics, label).replace(/[$,]/g, ""));
  assert.ok(actual >= expectedMinimum, `${label} should be at least ${expectedMinimum}, got ${actual}`);
}

function getCurrentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
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
  opportunities: string[];
  activities: string[];
  goals: string[];
  quotes: string[];
  estimates: string[];
  workOrders: string[];
}) {
  if (ids.activities.length > 0) {
    await db.activity.deleteMany({ where: { id: { in: ids.activities } } });
  }

  if (ids.goals.length > 0) {
    await db.salesGoal.deleteMany({ where: { id: { in: ids.goals } } });
  }

  if (ids.estimates.length > 0) {
    await db.estimate.deleteMany({ where: { id: { in: ids.estimates } } });
  }

  if (ids.quotes.length > 0) {
    await db.quote.deleteMany({ where: { id: { in: ids.quotes } } });
  }

  if (ids.workOrders.length > 0) {
    await db.workOrder.deleteMany({ where: { id: { in: ids.workOrders } } });
  }

  if (ids.opportunities.length > 0) {
    await db.opportunity.deleteMany({ where: { id: { in: ids.opportunities } } });
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
