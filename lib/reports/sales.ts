import { differenceInCalendarDays, startOfDay, subDays } from "date-fns";
import { EstimateStatus, OpportunityStage, QuoteStatus, Role } from "@/generated/prisma/client";
import { formatCurrency, toNumber } from "@/lib/core/money";
import { db } from "@/lib/db";
import type { DashboardMetric, DashboardRow, DashboardUser } from "@/lib/reports/dashboard";
import { periodBounds } from "@/lib/sales/goals";

const OPEN_PIPELINE_STAGES: OpportunityStage[] = [
  OpportunityStage.NEW,
  OpportunityStage.QUALIFIED,
  OpportunityStage.PROPOSAL,
  OpportunityStage.NEGOTIATION,
];

const CLOSED_PIPELINE_STAGES: OpportunityStage[] = [
  OpportunityStage.WON,
  OpportunityStage.LOST,
];

const QUOTE_TOUCH_STATUSES: QuoteStatus[] = [QuoteStatus.SENT, QuoteStatus.ACCEPTED];

const ESTIMATE_TOUCH_STATUSES: EstimateStatus[] = [
  EstimateStatus.SENT,
  EstimateStatus.APPROVED,
  EstimateStatus.CONVERTED,
];

const CONVERSION_WINDOW_DAYS = 90;
const CUSTOMER_WINDOW_DAYS = 365;

export type SalesReportWindow = {
  label: string;
  detail: string;
};

export type SalesCustomerReport = {
  scopeLabel: string;
  title: string;
  description: string;
  windows: SalesReportWindow[];
  heroMetrics: DashboardMetric[];
  pipelineMetrics: DashboardMetric[];
  stageRows: DashboardRow[];
  stageAgeRows: DashboardRow[];
  oldestOpenRows: DashboardRow[];
  performanceMetrics: DashboardMetric[];
  performanceRows: DashboardRow[];
  customerMetrics: DashboardMetric[];
  customerRows: DashboardRow[];
};

type CustomerAccumulator = {
  id: string;
  displayName: string;
  opportunityCount: number;
  openOpportunityCount: number;
  quoteCount: number;
  estimateCount: number;
  workOrderCount: number;
  wonOpportunityValue: number;
  openPipelineAmount: number;
  starterValueProxy: number;
  touchCount: number;
  latestTouchAt: Date | null;
};

type PerformanceAccumulator = {
  id: string;
  email: string;
  targetAmount: number;
  wonAmount: number;
  overdueFollowUps: number;
  openPipelineAmount: number;
};

export async function getSalesCustomerReport(user: DashboardUser): Promise<SalesCustomerReport> {
  const now = new Date();
  const scopedToRep = user.role === Role.SALES_REP;
  const conversionWindowStart = subDays(now, CONVERSION_WINDOW_DAYS);
  const customerWindowStart = subDays(now, CUSTOMER_WINDOW_DAYS);
  const currentPeriod = getCurrentPeriod(now);
  const { start: periodStart, end: periodEnd } = periodBounds(currentPeriod);

  const opportunityScope = scopedToRep ? { ownerUserId: user.id } : {};
  const activityScope = scopedToRep ? { ownerUserId: user.id } : {};
  const quoteScope = scopedToRep
    ? {
        OR: [
          { createdByUserId: user.id },
          {
            opportunity: {
              is: {
                deletedAt: null,
                ownerUserId: user.id,
              },
            },
          },
        ],
      }
    : {};
  const estimateScope = scopedToRep
    ? {
        OR: [
          { createdByUserId: user.id },
          {
            opportunity: {
              is: {
                deletedAt: null,
                ownerUserId: user.id,
              },
            },
          },
          {
            quote: {
              is: {
                deletedAt: null,
                createdByUserId: user.id,
              },
            },
          },
        ],
      }
    : {};
  const workOrderScope = scopedToRep
    ? {
        OR: [
          {
            opportunity: {
              is: {
                deletedAt: null,
                ownerUserId: user.id,
              },
            },
          },
          {
            quote: {
              is: {
                deletedAt: null,
                createdByUserId: user.id,
              },
            },
          },
          {
            convertedFromEstimate: {
              is: {
                deletedAt: null,
                createdByUserId: user.id,
              },
            },
          },
        ],
      }
    : {};

  const [
    openOpportunities,
    closedOpportunities,
    currentPeriodWon,
    overdueActivities,
    salesGoals,
    customerOpportunities,
    customerQuotes,
    customerEstimates,
    customerWorkOrders,
  ] = await Promise.all([
    db.opportunity.findMany({
      where: {
        deletedAt: null,
        stage: { in: OPEN_PIPELINE_STAGES },
        ...opportunityScope,
      },
      select: {
        id: true,
        name: true,
        stage: true,
        amount: true,
        createdAt: true,
        updatedAt: true,
        expectedCloseDate: true,
        ownerUserId: true,
        customer: {
          select: {
            id: true,
            displayName: true,
          },
        },
        ownerUser: {
          select: {
            email: true,
          },
        },
      },
      orderBy: [{ amount: "desc" }, { updatedAt: "asc" }],
    }),
    db.opportunity.findMany({
      where: {
        deletedAt: null,
        stage: { in: CLOSED_PIPELINE_STAGES },
        closedAt: { gte: conversionWindowStart },
        ...opportunityScope,
      },
      select: {
        id: true,
        name: true,
        stage: true,
        amount: true,
        createdAt: true,
        closedAt: true,
      },
      orderBy: { closedAt: "desc" },
    }),
    db.opportunity.findMany({
      where: {
        deletedAt: null,
        stage: OpportunityStage.WON,
        closedAt: {
          gte: periodStart,
          lt: periodEnd,
        },
        ...opportunityScope,
      },
      select: {
        id: true,
        ownerUserId: true,
        amount: true,
        ownerUser: {
          select: {
            email: true,
          },
        },
      },
    }),
    db.activity.findMany({
      where: {
        deletedAt: null,
        status: "OPEN",
        dueAt: { lte: now },
        OR: [{ leadId: { not: null } }, { opportunityId: { not: null } }],
        ...activityScope,
      },
      select: {
        id: true,
        ownerUserId: true,
        ownerUser: {
          select: {
            email: true,
          },
        },
      },
    }),
    db.salesGoal.findMany({
      where: {
        deletedAt: null,
        period: currentPeriod,
        ...(scopedToRep ? { userId: user.id } : {}),
      },
      select: {
        id: true,
        userId: true,
        targetAmount: true,
        user: {
          select: {
            email: true,
          },
        },
      },
      orderBy: [{ user: { email: "asc" } }],
    }),
    db.opportunity.findMany({
      where: {
        deletedAt: null,
        ...opportunityScope,
        OR: [
          { createdAt: { gte: customerWindowStart } },
          { closedAt: { gte: customerWindowStart } },
          { stage: { in: OPEN_PIPELINE_STAGES } },
        ],
      },
      select: {
        id: true,
        stage: true,
        amount: true,
        createdAt: true,
        closedAt: true,
        customer: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    }),
    db.quote.findMany({
      where: {
        deletedAt: null,
        status: { in: QUOTE_TOUCH_STATUSES },
        createdAt: { gte: customerWindowStart },
        ...quoteScope,
      },
      select: {
        id: true,
        status: true,
        total: true,
        createdAt: true,
        opportunityId: true,
        customer: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    }),
    db.estimate.findMany({
      where: {
        deletedAt: null,
        status: { in: ESTIMATE_TOUCH_STATUSES },
        createdAt: { gte: customerWindowStart },
        ...estimateScope,
      },
      select: {
        id: true,
        status: true,
        total: true,
        createdAt: true,
        opportunityId: true,
        quoteId: true,
        customer: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    }),
    db.workOrder.findMany({
      where: {
        deletedAt: null,
        openedAt: { gte: customerWindowStart },
        ...workOrderScope,
      },
      select: {
        id: true,
        workOrderNumber: true,
        openedAt: true,
        opportunityId: true,
        quoteId: true,
        convertedFromEstimate: {
          select: {
            id: true,
          },
        },
        lineItems: {
          where: {
            deletedAt: null,
          },
          select: {
            lineTotal: true,
          },
        },
        customer: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    }),
  ]);

  const openPipelineAmount = openOpportunities.reduce((sum, opportunity) => sum + toNumber(opportunity.amount), 0);
  const wonThisPeriodAmount = currentPeriodWon.reduce((sum, opportunity) => sum + toNumber(opportunity.amount), 0);
  const totalGoalTarget = salesGoals.reduce((sum, goal) => sum + toNumber(goal.targetAmount), 0);
  const closedCount = closedOpportunities.length;
  const wonClosedCount = closedOpportunities.filter((opportunity) => opportunity.stage === OpportunityStage.WON).length;
  const averageCloseDays = average(
    closedOpportunities
      .filter((opportunity) => opportunity.closedAt)
      .map((opportunity) =>
        Math.max(0, differenceInCalendarDays(opportunity.closedAt as Date, opportunity.createdAt)),
      ),
  );

  const customerRowsById = new Map<string, CustomerAccumulator>();

  for (const opportunity of customerOpportunities) {
    const row = ensureCustomerRow(
      customerRowsById,
      opportunity.customer.id,
      opportunity.customer.displayName,
    );

    row.opportunityCount += 1;
    row.touchCount += 1;
    row.latestTouchAt = maxDate(row.latestTouchAt, opportunity.closedAt ?? opportunity.createdAt);

    if (OPEN_PIPELINE_STAGES.includes(opportunity.stage)) {
      row.openOpportunityCount += 1;
      row.openPipelineAmount += toNumber(opportunity.amount);
    }

    if (opportunity.stage === OpportunityStage.WON) {
      row.wonOpportunityValue += toNumber(opportunity.amount);
      row.starterValueProxy += toNumber(opportunity.amount);
    }
  }

  for (const quote of customerQuotes) {
    const row = ensureCustomerRow(customerRowsById, quote.customer.id, quote.customer.displayName);
    row.quoteCount += 1;
    row.touchCount += 1;
    row.latestTouchAt = maxDate(row.latestTouchAt, quote.createdAt);

    if (quote.status === QuoteStatus.ACCEPTED && !quote.opportunityId) {
      row.starterValueProxy += toNumber(quote.total);
    }
  }

  for (const estimate of customerEstimates) {
    const row = ensureCustomerRow(customerRowsById, estimate.customer.id, estimate.customer.displayName);
    row.estimateCount += 1;
    row.touchCount += 1;
    row.latestTouchAt = maxDate(row.latestTouchAt, estimate.createdAt);

    if (
      (estimate.status === EstimateStatus.APPROVED || estimate.status === EstimateStatus.CONVERTED) &&
      !estimate.opportunityId &&
      !estimate.quoteId
    ) {
      row.starterValueProxy += toNumber(estimate.total);
    }
  }

  for (const workOrder of customerWorkOrders) {
    const row = ensureCustomerRow(
      customerRowsById,
      workOrder.customer.id,
      workOrder.customer.displayName,
    );
    row.workOrderCount += 1;
    row.touchCount += 1;
    row.latestTouchAt = maxDate(row.latestTouchAt, workOrder.openedAt);

    if (!workOrder.opportunityId && !workOrder.quoteId && !workOrder.convertedFromEstimate) {
      row.starterValueProxy += sumLineTotals(workOrder.lineItems);
    }
  }

  const customerRows = Array.from(customerRowsById.values());
  const repeatCustomerCount = customerRows.filter((row) => row.touchCount >= 2).length;
  const returningServiceCustomerCount = customerRows.filter((row) => row.workOrderCount >= 2).length;
  const pipelineCustomerCount = customerRows.filter((row) => row.openOpportunityCount > 0).length;
  const starterValueProxy = customerRows.reduce((sum, row) => sum + row.starterValueProxy, 0);

  const performanceRowsByUser = new Map<string, PerformanceAccumulator>();

  for (const goal of salesGoals) {
    const row = ensurePerformanceRow(performanceRowsByUser, goal.userId, goal.user.email);
    row.targetAmount += toNumber(goal.targetAmount);
  }

  for (const opportunity of currentPeriodWon) {
    if (!opportunity.ownerUserId) {
      continue;
    }

    const row = ensurePerformanceRow(
      performanceRowsByUser,
      opportunity.ownerUserId,
      opportunity.ownerUser?.email ?? "Unknown owner",
    );
    row.wonAmount += toNumber(opportunity.amount);
  }

  for (const activity of overdueActivities) {
    if (!activity.ownerUserId) {
      continue;
    }

    const row = ensurePerformanceRow(
      performanceRowsByUser,
      activity.ownerUserId,
      activity.ownerUser?.email ?? "Unknown owner",
    );
    row.overdueFollowUps += 1;
  }

  for (const opportunity of openOpportunities) {
    if (!opportunity.ownerUserId) {
      continue;
    }

    const row = ensurePerformanceRow(
      performanceRowsByUser,
      opportunity.ownerUserId,
      opportunity.ownerUser?.email ?? "Unknown owner",
    );
    row.openPipelineAmount += toNumber(opportunity.amount);
  }

  if (scopedToRep && !performanceRowsByUser.has(user.id)) {
    performanceRowsByUser.set(user.id, {
      id: user.id,
      email: user.email,
      targetAmount: 0,
      wonAmount: 0,
      overdueFollowUps: 0,
      openPipelineAmount: 0,
    });
  }

  const performanceRows = Array.from(performanceRowsByUser.values()).sort((left, right) => {
    const leftAttainment = left.targetAmount > 0 ? left.wonAmount / left.targetAmount : 0;
    const rightAttainment = right.targetAmount > 0 ? right.wonAmount / right.targetAmount : 0;

    if (rightAttainment !== leftAttainment) {
      return rightAttainment - leftAttainment;
    }

    if (right.wonAmount !== left.wonAmount) {
      return right.wonAmount - left.wonAmount;
    }

    return right.openPipelineAmount - left.openPipelineAmount;
  });

  const heroMetrics: DashboardMetric[] = [
    {
      label: "Open pipeline",
      value: formatCurrency(openPipelineAmount),
      detail: scopedToRep ? "Revenue still active in your current stages." : "Revenue still active in the team pipeline.",
      href: "#pipeline-conversion",
    },
    {
      label: "Won this period",
      value: formatCurrency(wonThisPeriodAmount),
      detail: scopedToRep ? `Closed-won revenue for ${currentPeriod}.` : `Team closed-won revenue for ${currentPeriod}.`,
      href: "#rep-performance",
    },
    {
      label: "Goal attainment",
      value: formatPercent(totalGoalTarget === 0 ? 0 : wonThisPeriodAmount / totalGoalTarget),
      detail: totalGoalTarget === 0 ? "No active sales goals are set for the current period." : `${formatCurrency(wonThisPeriodAmount)} against ${formatCurrency(totalGoalTarget)} this period.`,
      href: "#rep-performance",
    },
    {
      label: "Repeat customers",
      value: formatCount(repeatCustomerCount),
      detail: `Customers with at least two sales/service touches in the last ${CUSTOMER_WINDOW_DAYS} days.`,
      href: "#customer-growth",
    },
  ];

  const pipelineMetrics: DashboardMetric[] = [
    {
      label: "Open opportunities",
      value: formatCount(openOpportunities.length),
      detail: scopedToRep ? "Current opportunities still assigned to your book." : "Current opportunities still sitting in open stages.",
    },
    {
      label: "Closed (90d)",
      value: formatCount(closedCount),
      detail: `Won + lost opportunities with \`closedAt\` in the last ${CONVERSION_WINDOW_DAYS} days.`,
    },
    {
      label: "Win rate",
      value: formatPercent(closedCount === 0 ? 0 : wonClosedCount / closedCount),
      detail: "Closed-won count divided by total closed opportunities in the conversion window.",
    },
    {
      label: "Avg days to close",
      value: formatDays(averageCloseDays),
      detail: "Calendar days from `createdAt` to `closedAt` on recently closed opportunities.",
    },
  ];

  const stageRows: DashboardRow[] = OPEN_PIPELINE_STAGES.map((stage) => {
    const stageOpportunities = openOpportunities.filter((opportunity) => opportunity.stage === stage);

    return {
      label: titleCase(stage),
      value: `${formatCount(stageOpportunities.length)} | ${formatCurrency(
        stageOpportunities.reduce((sum, opportunity) => sum + toNumber(opportunity.amount), 0),
      )}`,
      detail: scopedToRep ? "Your active deals in this stage right now." : "Current open deals in this stage.",
      href: "/sales/opportunities",
    };
  }).filter((row) => !row.value.startsWith("0 |"));

  const stageAgeRows: DashboardRow[] = OPEN_PIPELINE_STAGES.map((stage) => {
    const stageOpportunities = openOpportunities.filter((opportunity) => opportunity.stage === stage);
    const stageAge = average(
      stageOpportunities.map((opportunity) =>
        stageAgeInDays(opportunity.updatedAt, opportunity.createdAt, now),
      ),
    );

    return {
      label: titleCase(stage),
      value: formatDays(stageAge),
      detail:
        stageOpportunities.length === 0
          ? "No open opportunities are sitting in this stage right now."
          : `${formatCount(stageOpportunities.length)} deals | ${formatCurrency(
              stageOpportunities.reduce((sum, opportunity) => sum + toNumber(opportunity.amount), 0),
            )} | current stage age proxy from last opportunity update.`,
      href: "/sales/opportunities",
    };
  }).filter((row) => row.detail !== "No open opportunities are sitting in this stage right now.");

  const oldestOpenRows: DashboardRow[] = openOpportunities
    .slice()
    .sort((left, right) => {
      const leftAge = stageAgeInDays(left.updatedAt, left.createdAt, now);
      const rightAge = stageAgeInDays(right.updatedAt, right.createdAt, now);

      if (rightAge !== leftAge) {
        return rightAge - leftAge;
      }

      return toNumber(right.amount) - toNumber(left.amount);
    })
    .slice(0, 8)
    .map((opportunity) => ({
      label: opportunity.name,
      value: formatCurrency(opportunity.amount),
      detail: `${opportunity.customer.displayName} | ${titleCase(opportunity.stage)} | ${formatDays(
        stageAgeInDays(opportunity.updatedAt, opportunity.createdAt, now),
      )} in current stage${opportunity.expectedCloseDate ? ` | closes ${formatDate(opportunity.expectedCloseDate)}` : ""}`,
      href: `/sales/opportunities/${opportunity.id}`,
    }));

  const performanceMetricRows = performanceRows.map((row) => ({
    id: row.id,
    email: row.email,
    targetAmount: row.targetAmount,
    wonAmount: row.wonAmount,
    overdueFollowUps: row.overdueFollowUps,
    openPipelineAmount: row.openPipelineAmount,
    attainmentPercent: row.targetAmount > 0 ? row.wonAmount / row.targetAmount : 0,
  }));

  const performanceMetrics: DashboardMetric[] = [
    {
      label: scopedToRep ? "Tracked rep" : "Tracked reps",
      value: formatCount(performanceMetricRows.length),
      detail: scopedToRep ? "Your own current-period performance row." : "Users with goals, won revenue, or overdue sales follow-ups this period.",
    },
    {
      label: "Goal target",
      value: formatCurrency(totalGoalTarget),
      detail: `Current-period target total for ${currentPeriod}.`,
    },
    {
      label: "Won this period",
      value: formatCurrency(wonThisPeriodAmount),
      detail: "Closed-won opportunity amount in the active goal window.",
    },
    {
      label: "Overdue follow-ups",
      value: formatCount(overdueActivities.length),
      detail: "Open lead/opportunity activities due now or earlier.",
    },
  ];

  const performanceRowsView: DashboardRow[] = performanceMetricRows.map((row) => ({
    label: row.email,
    value: row.targetAmount > 0 ? `${Math.round(row.attainmentPercent * 100)}% goal` : "No goal",
    detail: `${formatCurrency(row.wonAmount)} won | target ${
      row.targetAmount > 0 ? formatCurrency(row.targetAmount) : "not set"
    } | overdue ${formatCount(row.overdueFollowUps)} | open ${formatCurrency(row.openPipelineAmount)}`,
    href: scopedToRep ? "/sales/goals" : `/sales/goals?userId=${row.id}&period=${currentPeriod}`,
  }));

  const customerMetrics: DashboardMetric[] = [
    {
      label: "Repeat customers",
      value: formatCount(repeatCustomerCount),
      detail: "Customers with at least two recorded sales/service touches in the customer window.",
    },
    {
      label: "2+ work orders",
      value: formatCount(returningServiceCustomerCount),
      detail: "Customers who opened at least two work orders in the customer window.",
    },
    {
      label: "Pipeline customers",
      value: formatCount(pipelineCustomerCount),
      detail: "Customers who still have open opportunity value on the board.",
    },
    {
      label: "Starter value proxy",
      value: formatCurrency(starterValueProxy),
      detail: "Won opportunity amount plus unlinked accepted quote, approved estimate, and work-order value proxies.",
    },
  ];

  const customerRowsView: DashboardRow[] = customerRows
    .slice()
    .sort((left, right) => {
      if (right.starterValueProxy !== left.starterValueProxy) {
        return right.starterValueProxy - left.starterValueProxy;
      }

      if (right.touchCount !== left.touchCount) {
        return right.touchCount - left.touchCount;
      }

      return right.openPipelineAmount - left.openPipelineAmount;
    })
    .slice(0, 8)
    .map((row) => ({
      label: row.displayName,
      value: formatCurrency(row.starterValueProxy),
      detail: `${formatCount(row.touchCount)} touches | ${formatCount(row.opportunityCount)} opps | ${formatCount(
        row.quoteCount,
      )} quotes | ${formatCount(row.estimateCount)} estimates | ${formatCount(
        row.workOrderCount,
      )} work orders${row.openPipelineAmount > 0 ? ` | open ${formatCurrency(row.openPipelineAmount)}` : ""}`,
      href: `/customers/${row.id}`,
    }));

  return {
    scopeLabel: scopedToRep ? "Sales Rep View" : "Team Sales View",
    title: scopedToRep
      ? "Your pipeline, goals, and customer momentum in one report."
      : "Pipeline conversion, rep pressure, and customer growth in one team report.",
    description: scopedToRep
      ? "This report stays scoped to your own book: active stage mix, overdue follow-ups, current-month goal attainment, and the customers with the most commercial motion under your ownership."
      : "This report brings the whole sales motion together: open-stage pressure, closed conversion, current-month goal attainment, and customer growth signals from both sales and service touchpoints.",
    windows: [
      {
        label: "Live pipeline",
        detail: "Open opportunities in `NEW`, `QUALIFIED`, `PROPOSAL`, and `NEGOTIATION` right now.",
      },
      {
        label: "Conversion window",
        detail: `Closed opportunities with \`closedAt\` in the last ${CONVERSION_WINDOW_DAYS} days.`,
      },
      {
        label: "Goal window",
        detail: `Current calendar month (${currentPeriod}) based on won opportunities with \`closedAt\` inside the period.`,
      },
      {
        label: "Customer window",
        detail: `Opportunities, quotes, estimates, and work orders created/opened in the last ${CUSTOMER_WINDOW_DAYS} days, plus any still-open opportunities.`,
      },
      {
        label: "Stage age proxy",
        detail: "Current stage age uses calendar days since the opportunity's last `updatedAt` timestamp because stage-entry history is not stored yet.",
      },
    ],
    heroMetrics,
    pipelineMetrics,
    stageRows,
    stageAgeRows,
    oldestOpenRows,
    performanceMetrics,
    performanceRows: performanceRowsView,
    customerMetrics,
    customerRows: customerRowsView,
  };
}

function ensureCustomerRow(
  rows: Map<string, CustomerAccumulator>,
  id: string,
  displayName: string,
) {
  const existing = rows.get(id);

  if (existing) {
    return existing;
  }

  const created: CustomerAccumulator = {
    id,
    displayName,
    opportunityCount: 0,
    openOpportunityCount: 0,
    quoteCount: 0,
    estimateCount: 0,
    workOrderCount: 0,
    wonOpportunityValue: 0,
    openPipelineAmount: 0,
    starterValueProxy: 0,
    touchCount: 0,
    latestTouchAt: null,
  };

  rows.set(id, created);
  return created;
}

function ensurePerformanceRow(
  rows: Map<string, PerformanceAccumulator>,
  id: string,
  email: string,
) {
  const existing = rows.get(id);

  if (existing) {
    if (!existing.email && email) {
      existing.email = email;
    }

    return existing;
  }

  const created: PerformanceAccumulator = {
    id,
    email,
    targetAmount: 0,
    wonAmount: 0,
    overdueFollowUps: 0,
    openPipelineAmount: 0,
  };

  rows.set(id, created);
  return created;
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatDays(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0d";
  }

  if (Number.isInteger(value)) {
    return `${value}d`;
  }

  return `${value.toFixed(1)}d`;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(date);
}

function getCurrentPeriod(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function maxDate(current: Date | null, candidate: Date | null | undefined) {
  if (!candidate) {
    return current;
  }

  if (!current || candidate > current) {
    return candidate;
  }

  return current;
}

function stageAgeInDays(updatedAt: Date, createdAt: Date, now: Date) {
  const anchor = updatedAt ?? createdAt;
  return Math.max(0, differenceInCalendarDays(startOfDay(now), startOfDay(anchor)));
}

function sumLineTotals(
  lineItems: Array<{ lineTotal: number | string | { toNumber(): number } | null | undefined }>,
) {
  return lineItems.reduce((sum, lineItem) => sum + toNumber(lineItem.lineTotal), 0);
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
