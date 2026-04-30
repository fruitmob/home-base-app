import { differenceInCalendarDays, startOfMonth, startOfWeek, subDays } from "date-fns";
import {
  OpportunityStage,
  Role,
  TimeEntryStatus,
  WarrantyClaimStatus,
  WorkOrderStatus,
} from "@/generated/prisma/client";
import { getExceptionCounts } from "@/lib/admin/exceptions";
import { formatCurrency, toNumber } from "@/lib/core/money";
import { db } from "@/lib/db";

const ACTIVE_WORK_ORDER_STATUSES: WorkOrderStatus[] = [
  WorkOrderStatus.OPEN,
  WorkOrderStatus.IN_PROGRESS,
  WorkOrderStatus.ON_HOLD_PARTS,
  WorkOrderStatus.ON_HOLD_DELAY,
  WorkOrderStatus.QC,
  WorkOrderStatus.READY_TO_BILL,
];

const OPEN_PIPELINE_STAGES: OpportunityStage[] = [
  OpportunityStage.NEW,
  OpportunityStage.QUALIFIED,
  OpportunityStage.PROPOSAL,
  OpportunityStage.NEGOTIATION,
];

const OPEN_CLAIM_STATUSES: WarrantyClaimStatus[] = [
  WarrantyClaimStatus.OPEN,
  WarrantyClaimStatus.SUBMITTED,
  WarrantyClaimStatus.APPROVED,
];

const APPROVED_TIME_ENTRY_STATUSES: TimeEntryStatus[] = [
  TimeEntryStatus.APPROVED,
  TimeEntryStatus.SUBMITTED,
  TimeEntryStatus.LOCKED,
];

export type DashboardUser = {
  id: string;
  email: string;
  role: Role;
};

export type DashboardAction = {
  label: string;
  href: string;
  variant?: "primary" | "secondary";
};

export type DashboardMetric = {
  label: string;
  value: string;
  detail: string;
  href?: string;
};

export type DashboardRow = {
  label: string;
  value: string;
  detail: string;
  href?: string;
};

export type DashboardSection = {
  title: string;
  description: string;
  items: DashboardRow[];
  emptyMessage: string;
};

export type DashboardSnapshot = {
  eyebrow: string;
  title: string;
  description: string;
  actions: DashboardAction[];
  metrics: DashboardMetric[];
  sections: DashboardSection[];
};

export type ReportOverviewCard = {
  id: string;
  title: string;
  description: string;
  href: string;
  metrics: DashboardMetric[];
  rows: DashboardRow[];
  emptyMessage: string;
};

type WorkOrderListRow = {
  id: string;
  workOrderNumber: string;
  title: string;
  status: WorkOrderStatus;
  openedAt: Date;
  promisedAt: Date | null;
  customer: {
    displayName: string;
  };
};

type WorkOrderListFilter = {
  assignedTechUserId?: string;
  serviceWriterUserId?: string;
  status?: WorkOrderStatus | WorkOrderStatus[];
  limit?: number;
};

type OpportunityListFilter = {
  ownerUserId?: string;
  stages?: OpportunityStage[];
  limit?: number;
};

export async function getDashboardSnapshot(user: DashboardUser): Promise<DashboardSnapshot> {
  switch (user.role) {
    case Role.OWNER:
    case Role.ADMIN:
      return buildLeadershipDashboard(true);
    case Role.MANAGER:
      return buildLeadershipDashboard(false);
    case Role.SERVICE_MANAGER:
      return buildServiceManagerDashboard();
    case Role.SERVICE_WRITER:
      return buildServiceWriterDashboard(user);
    case Role.TECH:
      return buildTechDashboard(user);
    case Role.PARTS:
      return buildPartsDashboard();
    case Role.INSPECTOR:
      return buildInspectorDashboard(user);
    case Role.SALES_MANAGER:
      return buildSalesDashboard(user, false);
    case Role.SALES_REP:
      return buildSalesDashboard(user, true);
    case Role.ACCOUNTANT:
      return buildAccountantDashboard();
    case Role.VIEWER:
    default:
      return buildViewerDashboard();
  }
}

export async function getReportOverviewCards(user?: DashboardUser): Promise<ReportOverviewCard[]> {
  const [service, sales, inventory, closeout, quality] = await Promise.all([
    getServiceOverview(),
    getSalesOverview(user?.role === Role.SALES_REP ? user.id : undefined),
    getInventoryOverview(),
    getCloseoutOverview(),
    getQualityOverview(),
  ]);

  return [
    {
      id: "service-ops",
      title: "Service Operations",
      description: "WIP flow, aging pressure, staffing gaps, and technician readiness.",
      href: "/reports/service",
      metrics: service.metrics,
      rows: service.oldestOpenRows,
      emptyMessage: "No active work orders are aging right now.",
    },
    {
      id: "sales-pipeline",
      title: "Sales Pipeline",
      description: "Pipeline mix, won-vs-goal momentum, overdue follow-ups, and customer growth pressure.",
      href: "/reports/sales",
      metrics: sales.metrics,
      rows: sales.stageRows,
      emptyMessage: "No active opportunities are in the pipeline right now.",
    },
    {
      id: "parts-inventory",
      title: "Parts & Inventory",
      description: "Stock pressure, reserved inventory, and the last 30 days of movement.",
      href: "/reports/parts",
      metrics: inventory.metrics,
      rows: inventory.lowStockRows,
      emptyMessage: "No low-stock parts are calling for attention.",
    },
    {
      id: "financial-closeout",
      title: "Financial Closeout",
      description: "Ready-to-bill queue, approved estimate and change-order totals, and warranty recovery.",
      href: "/reports/closeout",
      metrics: closeout.metrics,
      rows: closeout.rows,
      emptyMessage: "No closeout activity is pending right now.",
    },
    {
      id: "quality-risk",
      title: "Quality & Risk",
      description: "Inspection backlog, warranty exposure, and cross-module exception pressure.",
      href: "/warranty",
      metrics: quality.metrics,
      rows: quality.rows,
      emptyMessage: "No quality or risk exceptions are open right now.",
    },
  ];
}

async function buildLeadershipDashboard(canReachAdmin: boolean): Promise<DashboardSnapshot> {
  const [service, sales, quality] = await Promise.all([
    getServiceOverview(),
    getSalesOverview(),
    getQualityOverview(),
  ]);

  return {
    eyebrow: canReachAdmin ? "Owner + Admin" : "Manager",
    title: canReachAdmin ? "Leadership dashboard for the whole shop." : "Cross-shop pulse for the floor and the pipeline.",
    description: canReachAdmin
      ? "See where work is stacking up, how revenue is moving, and which risks need a human decision next."
      : "Track operations and revenue in one place without bouncing between service, sales, and admin screens.",
    actions: [
      { label: "Open reports hub", href: "/reports", variant: "primary" },
      { label: "View work orders", href: "/work-orders", variant: "secondary" },
      ...(canReachAdmin ? [{ label: "Open admin tools", href: "/admin", variant: "secondary" as const }] : []),
    ],
    metrics: canReachAdmin
      ? [
          service.metrics[0],
          service.metrics[1],
          sales.metrics[0],
          quality.metrics[3],
        ]
      : [
          service.metrics[0],
          service.metrics[2],
          sales.metrics[0],
          sales.metrics[2],
        ],
    sections: [
      {
        title: "Service flow",
        description: "The oldest active work orders and where the floor is bunching up.",
        items: service.oldestOpenRows,
        emptyMessage: "Service flow is clear right now.",
      },
      {
        title: "Pipeline pulse",
        description: "Open stages ranked by count and amount.",
        items: sales.stageRows,
        emptyMessage: "No pipeline rows are available yet.",
      },
      {
        title: "Risk watch",
        description: "Exceptions and open claims that deserve a leadership look.",
        items: quality.rows,
        emptyMessage: "No elevated risks were found.",
      },
    ],
  };
}

async function buildServiceManagerDashboard(): Promise<DashboardSnapshot> {
  const service = await getServiceOverview();

  return {
    eyebrow: "Service Manager",
    title: "Keep the floor moving and the bottlenecks visible.",
    description: "This view stays focused on WIP flow, staffing gaps, and the work orders that will age into trouble next.",
    actions: [
      { label: "Open work orders", href: "/work-orders", variant: "primary" },
      { label: "Review time approvals", href: "/time/approval", variant: "secondary" },
      { label: "Open reports hub", href: "/reports", variant: "secondary" },
    ],
    metrics: service.metrics,
    sections: [
      {
        title: "Oldest open work",
        description: "The active jobs that have been on the board the longest.",
        items: service.oldestOpenRows,
        emptyMessage: "No active work orders are aging right now.",
      },
      {
        title: "Status lanes",
        description: "Current count by service status.",
        items: service.statusRows,
        emptyMessage: "No active work orders are on the board right now.",
      },
    ],
  };
}

async function buildServiceWriterDashboard(user: DashboardUser): Promise<DashboardSnapshot> {
  const [myActiveWorkOrders, sentEstimates, readyToBillCount, submittedTimeCount] = await Promise.all([
    db.workOrder.count({
      where: {
        deletedAt: null,
        serviceWriterUserId: user.id,
        status: { in: ACTIVE_WORK_ORDER_STATUSES },
      },
    }),
    db.estimate.count({
      where: {
        deletedAt: null,
        createdByUserId: user.id,
        status: "SENT",
      },
    }),
    db.workOrder.count({
      where: {
        deletedAt: null,
        status: WorkOrderStatus.READY_TO_BILL,
      },
    }),
    db.timeEntry.count({
      where: {
        deletedAt: null,
        status: "SUBMITTED",
      },
    }),
  ]);

  const myWorkRows = await listWorkOrderRows({
    serviceWriterUserId: user.id,
    status: ACTIVE_WORK_ORDER_STATUSES,
  });

  return {
    eyebrow: "Service Writer",
    title: "Track the work you opened and the approvals still in motion.",
    description: "This desk keeps your active work, sent estimates, and shop handoff pressure close together.",
    actions: [
      { label: "Open work orders", href: "/work-orders", variant: "primary" },
      { label: "Open estimates", href: "/estimates", variant: "secondary" },
      { label: "Open reports hub", href: "/reports", variant: "secondary" },
    ],
    metrics: [
      {
        label: "My active work orders",
        value: formatCount(myActiveWorkOrders),
        detail: "Jobs you opened that are still on the board.",
        href: "/work-orders",
      },
      {
        label: "Sent estimates",
        value: formatCount(sentEstimates),
        detail: "Waiting on customer approval or next follow-up.",
        href: "/estimates",
      },
      {
        label: "Ready to bill",
        value: formatCount(readyToBillCount),
        detail: "Shop-wide work orders staged for billing.",
        href: "/work-orders",
      },
      {
        label: "Submitted time",
        value: formatCount(submittedTimeCount),
        detail: "Entries waiting on review before closeout.",
        href: "/time/approval",
      },
    ],
    sections: [
      {
        title: "My open jobs",
        description: "The work orders you are actively shepherding through the shop.",
        items: myWorkRows,
        emptyMessage: "You do not have any active work orders right now.",
      },
    ],
  };
}

async function buildTechDashboard(user: DashboardUser): Promise<DashboardSnapshot> {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const [myOpenWorkOrders, activeTimers, timeTotals, myQueue] = await Promise.all([
    db.workOrder.count({
      where: {
        deletedAt: null,
        assignedTechUserId: user.id,
        status: { in: ACTIVE_WORK_ORDER_STATUSES },
      },
    }),
    db.timeEntry.count({
      where: {
        deletedAt: null,
        userId: user.id,
        active: true,
      },
    }),
    db.timeEntry.aggregate({
      where: {
        deletedAt: null,
        userId: user.id,
        status: { in: APPROVED_TIME_ENTRY_STATUSES },
        startedAt: { gte: weekStart },
      },
      _sum: {
        billableMinutes: true,
        goodwillMinutes: true,
        durationMinutes: true,
      },
    }),
    listWorkOrderRows({
      assignedTechUserId: user.id,
      status: ACTIVE_WORK_ORDER_STATUSES,
    }),
  ]);

  return {
    eyebrow: "Technician",
    title: "Your queue, your hours, and the next jobs to clear.",
    description: "Stay anchored on assigned work, active timers, and how much of the week is landing as billable or goodwill time.",
    actions: [
      { label: "Open my time", href: "/time", variant: "primary" },
      { label: "Open work orders", href: "/work-orders", variant: "secondary" },
      { label: "Open reports hub", href: "/reports", variant: "secondary" },
    ],
    metrics: [
      {
        label: "My open work",
        value: formatCount(myOpenWorkOrders),
        detail: "Assigned work orders that are still active.",
        href: "/work-orders",
      },
      {
        label: "Active timers",
        value: formatCount(activeTimers),
        detail: "Time entries currently running under your login.",
        href: "/time",
      },
      {
        label: "Billable hours",
        value: formatHours(toNumber(timeTotals._sum.billableMinutes)),
        detail: "Approved or submitted hours this week.",
        href: "/time",
      },
      {
        label: "Goodwill hours",
        value: formatHours(toNumber(timeTotals._sum.goodwillMinutes)),
        detail: "Non-billable minutes logged this week.",
        href: "/time",
      },
    ],
    sections: [
      {
        title: "Assigned queue",
        description: "The active jobs assigned to you, ordered by urgency and promise date.",
        items: myQueue,
        emptyMessage: "You do not have active assigned work orders right now.",
      },
    ],
  };
}

async function buildPartsDashboard(): Promise<DashboardSnapshot> {
  const inventory = await getInventoryOverview();

  return {
    eyebrow: "Parts",
    title: "Watch stock pressure before it slows the floor down.",
    description: "Low-stock parts, reserved inventory, and recent movement all stay together here so shortages are visible early.",
    actions: [
      { label: "Open parts", href: "/parts", variant: "primary" },
      { label: "Open work orders", href: "/work-orders", variant: "secondary" },
      { label: "Open reports hub", href: "/reports", variant: "secondary" },
    ],
    metrics: inventory.metrics,
    sections: [
      {
        title: "Low-stock watchlist",
        description: "Parts that are already at or below their reorder point.",
        items: inventory.lowStockRows,
        emptyMessage: "No low-stock parts need attention right now.",
      },
    ],
  };
}

async function buildInspectorDashboard(user: DashboardUser): Promise<DashboardSnapshot> {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const [myDrafts, completedThisWeek, qcQueueCount, openClaims, draftRows, qcRows] = await Promise.all([
    db.arrivalInspection.count({
      where: {
        deletedAt: null,
        performedByUserId: user.id,
        status: "DRAFT",
      },
    }),
    db.arrivalInspection.count({
      where: {
        deletedAt: null,
        performedByUserId: user.id,
        status: "COMPLETE",
        performedAt: { gte: weekStart },
      },
    }),
    db.workOrder.count({
      where: {
        deletedAt: null,
        status: WorkOrderStatus.QC,
      },
    }),
    db.warrantyClaim.count({
      where: {
        deletedAt: null,
        status: { in: OPEN_CLAIM_STATUSES },
      },
    }),
    db.arrivalInspection.findMany({
      where: {
        deletedAt: null,
        performedByUserId: user.id,
        status: "DRAFT",
      },
      select: {
        id: true,
        type: true,
        vehicle: {
          select: {
            year: true,
            make: true,
            model: true,
            unitNumber: true,
          },
        },
        customer: {
          select: {
            displayName: true,
          },
        },
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
      take: 5,
    }),
    db.workOrder.findMany({
      where: {
        deletedAt: null,
        status: WorkOrderStatus.QC,
      },
      select: {
        id: true,
        workOrderNumber: true,
        title: true,
        customer: {
          select: {
            displayName: true,
          },
        },
        promisedAt: true,
      },
      orderBy: [{ promisedAt: "asc" }, { openedAt: "asc" }],
      take: 5,
    }),
  ]);

  return {
    eyebrow: "Inspector",
    title: "See the inspection backlog and the next quality handoffs.",
    description: "This view keeps your draft inspections, QC queue, and warranty pressure close to the work in motion.",
    actions: [
      { label: "Open inspections", href: "/inspections", variant: "primary" },
      { label: "Open shop floor", href: "/shop", variant: "secondary" },
      { label: "Open reports hub", href: "/reports", variant: "secondary" },
    ],
    metrics: [
      {
        label: "My draft inspections",
        value: formatCount(myDrafts),
        detail: "Arrival or PDI checklists still waiting on completion.",
        href: "/inspections",
      },
      {
        label: "Completed this week",
        value: formatCount(completedThisWeek),
        detail: "Inspections you closed since Monday.",
        href: "/inspections",
      },
      {
        label: "QC queue",
        value: formatCount(qcQueueCount),
        detail: "Work orders currently waiting on quality review.",
        href: "/shop",
      },
      {
        label: "Open claims",
        value: formatCount(openClaims),
        detail: "Warranty claims still in flight.",
        href: "/warranty",
      },
    ],
    sections: [
      {
        title: "My inspection drafts",
        description: "Draft inspections assigned to you and waiting to be finished.",
        items: draftRows.map((inspection) => ({
          label: formatVehicleLabel(inspection.vehicle),
          value: titleCase(inspection.type),
          detail: `${inspection.customer.displayName} | started ${formatRelativeDays(inspection.createdAt)}`,
          href: `/inspections/${inspection.id}`,
        })),
        emptyMessage: "You do not have any draft inspections right now.",
      },
      {
        title: "QC queue",
        description: "The next work orders sitting in the quality lane.",
        items: qcRows.map((workOrder) => ({
          label: workOrder.workOrderNumber,
          value: workOrder.customer.displayName,
          detail: workOrder.promisedAt
            ? `Promised ${formatDate(workOrder.promisedAt)}`
            : trimSentence(workOrder.title),
          href: `/work-orders/${workOrder.id}`,
        })),
        emptyMessage: "No work orders are waiting in QC.",
      },
    ],
  };
}

async function buildSalesDashboard(user: DashboardUser, scopedToRep: boolean): Promise<DashboardSnapshot> {
  const sales = await getSalesOverview(scopedToRep ? user.id : undefined);

  return {
    eyebrow: scopedToRep ? "Sales Rep" : "Sales Manager",
    title: scopedToRep ? "Your active pipeline and follow-ups in one glance." : "Team revenue motion without the spreadsheet hop.",
    description: scopedToRep
      ? "Stay on top of open pipeline, won revenue this month, overdue follow-ups, and the deals most likely to move next."
      : "Watch stage pressure, rep follow-up load, and the largest active opportunities from one dashboard.",
    actions: [
      { label: "Open pipeline", href: "/sales/opportunities", variant: "primary" },
      { label: "Open leads", href: "/sales/leads", variant: "secondary" },
      { label: "Open reports hub", href: "/reports", variant: "secondary" },
    ],
    metrics: sales.metrics,
    sections: [
      {
        title: "Stage summary",
        description: "Open stages ranked by count and value.",
        items: sales.stageRows,
        emptyMessage: "No open opportunities are active right now.",
      },
      {
        title: scopedToRep ? "My biggest open deals" : "Biggest open deals",
        description: "The largest active opportunities still in flight.",
        items: sales.opportunityRows,
        emptyMessage: "No active opportunities are available yet.",
      },
    ],
  };
}

async function buildAccountantDashboard(): Promise<DashboardSnapshot> {
  const monthStart = startOfMonth(new Date());
  const [readyToBillCount, closedThisMonth, approvedEstimateTotals, warrantyRecovered, readyRows] = await Promise.all([
    db.workOrder.count({
      where: {
        deletedAt: null,
        status: WorkOrderStatus.READY_TO_BILL,
      },
    }),
    db.workOrder.count({
      where: {
        deletedAt: null,
        closedAt: { gte: monthStart },
      },
    }),
    db.estimate.aggregate({
      where: {
        deletedAt: null,
        status: "APPROVED",
        approvedAt: { gte: monthStart },
      },
      _sum: {
        total: true,
      },
    }),
    db.warrantyClaim.aggregate({
      where: {
        deletedAt: null,
        status: "RECOVERED",
        resolvedAt: { gte: monthStart },
      },
      _sum: {
        recoveryAmount: true,
      },
    }),
    listWorkOrderRows({
      status: WorkOrderStatus.READY_TO_BILL,
    }),
  ]);

  return {
    eyebrow: "Accountant",
    title: "Billing-ready work and recovered dollars, without hunting for them.",
    description: "This view stays pointed at what can close this month and where recoverable revenue is already on the table.",
    actions: [
      { label: "Open work orders", href: "/work-orders", variant: "primary" },
      { label: "Open warranty claims", href: "/warranty", variant: "secondary" },
      { label: "Open reports hub", href: "/reports", variant: "secondary" },
    ],
    metrics: [
      {
        label: "Ready to bill",
        value: formatCount(readyToBillCount),
        detail: "Work orders already staged for billing.",
        href: "/work-orders",
      },
      {
        label: "Closed this month",
        value: formatCount(closedThisMonth),
        detail: "Work orders marked closed since the start of the month.",
        href: "/work-orders",
      },
      {
        label: "Approved estimate value",
        value: formatCurrency(approvedEstimateTotals._sum.total ?? 0),
        detail: "Approved estimate dollars this month.",
        href: "/estimates",
      },
      {
        label: "Warranty recovered",
        value: formatCurrency(warrantyRecovered._sum.recoveryAmount ?? 0),
        detail: "Recovered claim dollars this month.",
        href: "/warranty",
      },
    ],
    sections: [
      {
        title: "Ready-to-bill queue",
        description: "The first work orders likely to turn into finalized billing work.",
        items: readyRows,
        emptyMessage: "No work orders are staged as ready to bill right now.",
      },
    ],
  };
}

async function buildViewerDashboard(): Promise<DashboardSnapshot> {
  const [customerCount, vehicleCount, openWorkOrders, openCases, service, sales] = await Promise.all([
    db.customer.count({ where: { deletedAt: null } }),
    db.vehicle.count({ where: { deletedAt: null } }),
    db.workOrder.count({
      where: {
        deletedAt: null,
        status: { in: ACTIVE_WORK_ORDER_STATUSES },
      },
    }),
    db.case.count({
      where: {
        deletedAt: null,
        status: { in: ["OPEN", "WAITING"] },
      },
    }),
    getServiceOverview(),
    getSalesOverview(),
  ]);

  return {
    eyebrow: "Overview",
    title: "A read-only pulse across customers, work, and pipeline.",
    description: "Use this as the starting point when you need situational awareness without taking any write actions.",
    actions: [
      { label: "Open customers", href: "/customers", variant: "primary" },
      { label: "Open work orders", href: "/work-orders", variant: "secondary" },
      { label: "Open reports hub", href: "/reports", variant: "secondary" },
    ],
    metrics: [
      {
        label: "Customers",
        value: formatCount(customerCount),
        detail: "Active customer records in the shop database.",
        href: "/customers",
      },
      {
        label: "Vehicles",
        value: formatCount(vehicleCount),
        detail: "Vehicle records linked into active history.",
        href: "/vehicles",
      },
      {
        label: "Active work orders",
        value: formatCount(openWorkOrders),
        detail: "Open, in-progress, hold, QC, and ready-to-bill jobs.",
        href: "/work-orders",
      },
      {
        label: "Open cases",
        value: formatCount(openCases),
        detail: "Cases still waiting on resolution or follow-up.",
        href: "/cases",
      },
    ],
    sections: [
      {
        title: "Service flow",
        description: "The oldest active work orders currently on the board.",
        items: service.oldestOpenRows,
        emptyMessage: "No active work orders are aging right now.",
      },
      {
        title: "Sales pulse",
        description: "Open pipeline by stage and amount.",
        items: sales.stageRows,
        emptyMessage: "No active opportunities are in the pipeline.",
      },
    ],
  };
}

async function getServiceOverview() {
  const now = new Date();
  const twoDaysAgo = subDays(now, 2);
  const sevenDaysAgo = subDays(now, 7);

  const [activeCount, readyToBillCount, unassignedCount, submittedTimeCount, youngWork, middleWork, oldWork, statusGroups, oldestOpenRows] =
    await Promise.all([
      db.workOrder.count({
        where: {
          deletedAt: null,
          status: { in: ACTIVE_WORK_ORDER_STATUSES },
        },
      }),
      db.workOrder.count({
        where: {
          deletedAt: null,
          status: WorkOrderStatus.READY_TO_BILL,
        },
      }),
      db.workOrder.count({
        where: {
          deletedAt: null,
          status: { in: [WorkOrderStatus.OPEN, WorkOrderStatus.IN_PROGRESS] },
          assignedTechUserId: null,
        },
      }),
      db.timeEntry.count({
        where: {
          deletedAt: null,
          status: "SUBMITTED",
        },
      }),
      db.workOrder.count({
        where: {
          deletedAt: null,
          status: { in: ACTIVE_WORK_ORDER_STATUSES },
          openedAt: { gte: twoDaysAgo },
        },
      }),
      db.workOrder.count({
        where: {
          deletedAt: null,
          status: { in: ACTIVE_WORK_ORDER_STATUSES },
          openedAt: { lt: twoDaysAgo, gte: sevenDaysAgo },
        },
      }),
      db.workOrder.count({
        where: {
          deletedAt: null,
          status: { in: ACTIVE_WORK_ORDER_STATUSES },
          openedAt: { lt: sevenDaysAgo },
        },
      }),
      db.workOrder.groupBy({
        by: ["status"],
        where: {
          deletedAt: null,
          status: { in: ACTIVE_WORK_ORDER_STATUSES },
        },
        _count: {
          _all: true,
        },
      }),
      listWorkOrderRows({
        status: ACTIVE_WORK_ORDER_STATUSES,
      }),
    ]);

  const statusMap = new Map(statusGroups.map((row) => [row.status, row._count._all]));

  return {
    metrics: [
      {
        label: "Active WIP",
        value: formatCount(activeCount),
        detail: "Open, hold, QC, and ready-to-bill work orders.",
        href: "/work-orders",
      },
      {
        label: "Ready to bill",
        value: formatCount(readyToBillCount),
        detail: "Jobs that can move into closeout and billing work.",
        href: "/work-orders",
      },
      {
        label: "Unassigned work",
        value: formatCount(unassignedCount),
        detail: "Open or in-progress jobs without a technician.",
        href: "/work-orders",
      },
      {
        label: "Submitted time",
        value: formatCount(submittedTimeCount),
        detail: "Entries waiting for approval.",
        href: "/time/approval",
      },
    ],
    statusRows: [
      makeSummaryRow("Open", statusMap.get(WorkOrderStatus.OPEN) ?? 0, "New jobs still waiting to move."),
      makeSummaryRow("In progress", statusMap.get(WorkOrderStatus.IN_PROGRESS) ?? 0, "Work actively underway."),
      makeSummaryRow("On hold", (statusMap.get(WorkOrderStatus.ON_HOLD_PARTS) ?? 0) + (statusMap.get(WorkOrderStatus.ON_HOLD_DELAY) ?? 0), "Work paused on parts or external delay."),
      makeSummaryRow("QC", statusMap.get(WorkOrderStatus.QC) ?? 0, "Jobs waiting on quality review."),
      makeSummaryRow("Ready to bill", statusMap.get(WorkOrderStatus.READY_TO_BILL) ?? 0, "Work staged for closeout."),
    ],
    oldestOpenRows,
    agingRows: [
      makeSummaryRow("0-2 days", youngWork, "Freshly opened or recently started work."),
      makeSummaryRow("3-7 days", middleWork, "Mid-cycle work needing momentum."),
      makeSummaryRow("8+ days", oldWork, "Aging jobs most likely to become escalations."),
    ],
  };
}

async function getSalesOverview(ownerUserId?: string) {
  const monthStart = startOfMonth(new Date());
  const ownerFilter = ownerUserId ? { ownerUserId } : {};

  const [stageGroups, wonThisMonth, dueActivities, sentQuotes, opportunityRows] = await Promise.all([
    db.opportunity.groupBy({
      by: ["stage"],
      where: {
        deletedAt: null,
        stage: { in: OPEN_PIPELINE_STAGES },
        ...ownerFilter,
      },
      _count: {
        _all: true,
      },
      _sum: {
        amount: true,
      },
    }),
    db.opportunity.aggregate({
      where: {
        deletedAt: null,
        stage: OpportunityStage.WON,
        closedAt: { gte: monthStart },
        ...ownerFilter,
      },
      _sum: {
        amount: true,
      },
    }),
    db.activity.count({
      where: {
        deletedAt: null,
        status: "OPEN",
        dueAt: { lte: new Date() },
        OR: [{ leadId: { not: null } }, { opportunityId: { not: null } }],
        ...(ownerUserId ? { ownerUserId } : {}),
      },
    }),
    db.quote.count({
      where: {
        deletedAt: null,
        status: "SENT",
        ...(ownerUserId ? { createdByUserId: ownerUserId } : {}),
      },
    }),
    listOpportunityRows({ ownerUserId, stages: OPEN_PIPELINE_STAGES }),
  ]);

  const openPipelineAmount = stageGroups.reduce((total, row) => total + toNumber(row._sum.amount), 0);

  return {
    metrics: [
      {
        label: "Open pipeline",
        value: formatCurrency(openPipelineAmount),
        detail: ownerUserId ? "Revenue still in your active stages." : "Revenue still in active pipeline stages.",
        href: "/sales/opportunities",
      },
      {
        label: "Won this month",
        value: formatCurrency(wonThisMonth._sum.amount ?? 0),
        detail: ownerUserId ? "Closed-won revenue under your ownership." : "Closed-won revenue since the start of the month.",
        href: "/sales/opportunities",
      },
      {
        label: "Due follow-ups",
        value: formatCount(dueActivities),
        detail: "Open lead or opportunity activities due now or overdue.",
        href: "/sales/leads",
      },
      {
        label: "Sent quotes",
        value: formatCount(sentQuotes),
        detail: "Quotes waiting on a yes, no, or revision.",
        href: "/quotes",
      },
    ],
    stageRows: stageGroups
      .sort((left, right) => stageRank(left.stage) - stageRank(right.stage))
      .map((row) => ({
        label: titleCase(row.stage),
        value: `${formatCount(row._count._all)} | ${formatCurrency(row._sum.amount ?? 0)}`,
        detail: ownerUserId ? "Your active deals in this stage." : "Active opportunities in this stage.",
        href: "/sales/opportunities",
      })),
    opportunityRows,
  };
}

async function getInventoryOverview() {
  const thirtyDaysAgo = subDays(new Date(), 30);

  const [parts, txGroups] = await Promise.all([
    db.part.findMany({
      where: {
        deletedAt: null,
        active: true,
      },
      select: {
        id: true,
        sku: true,
        name: true,
        quantityOnHand: true,
        quantityReserved: true,
        reorderPoint: true,
      },
    }),
    db.partTransaction.groupBy({
      by: ["type"],
      where: {
        occurredAt: { gte: thirtyDaysAgo },
      },
      _sum: {
        quantity: true,
      },
    }),
  ]);

  const lowStockParts = parts
    .filter((part) => toNumber(part.reorderPoint) > 0 && toNumber(part.quantityOnHand) <= toNumber(part.reorderPoint))
    .sort((left, right) => {
      const leftGap = toNumber(left.quantityOnHand) - toNumber(left.reorderPoint);
      const rightGap = toNumber(right.quantityOnHand) - toNumber(right.reorderPoint);
      return leftGap - rightGap;
    });

  const issued = txGroups
    .filter((row) => row.type === "ISSUE")
    .reduce((total, row) => total + toNumber(row._sum.quantity), 0);

  const received = txGroups
    .filter((row) => row.type === "RECEIVE")
    .reduce((total, row) => total + toNumber(row._sum.quantity), 0);

  return {
    metrics: [
      {
        label: "Low-stock parts",
        value: formatCount(lowStockParts.length),
        detail: "At or below reorder point right now.",
        href: "/parts",
      },
      {
        label: "Reserved quantity",
        value: formatDecimal(parts.reduce((total, part) => total + toNumber(part.quantityReserved), 0)),
        detail: "Units currently held against active work.",
        href: "/parts",
      },
      {
        label: "Received (30d)",
        value: formatDecimal(received),
        detail: "Units received into inventory in the last 30 days.",
        href: "/parts",
      },
      {
        label: "Issued (30d)",
        value: formatDecimal(issued),
        detail: "Units issued from stock in the last 30 days.",
        href: "/parts",
      },
    ],
    lowStockRows: lowStockParts.slice(0, 5).map((part) => ({
      label: `${part.sku} | ${part.name}`,
      value: `${formatDecimal(part.quantityOnHand)} on hand`,
      detail: `Reorder at ${formatDecimal(part.reorderPoint)} | reserved ${formatDecimal(part.quantityReserved)}`,
      href: `/parts/${part.id}`,
    })),
  };
}

async function getQualityOverview() {
  const monthStart = startOfMonth(new Date());
  const [draftInspections, openClaims, recovered, exceptionCounts] = await Promise.all([
    db.arrivalInspection.count({
      where: {
        deletedAt: null,
        status: "DRAFT",
      },
    }),
    db.warrantyClaim.count({
      where: {
        deletedAt: null,
        status: { in: OPEN_CLAIM_STATUSES },
      },
    }),
    db.warrantyClaim.aggregate({
      where: {
        deletedAt: null,
        status: "RECOVERED",
        resolvedAt: { gte: monthStart },
      },
      _sum: {
        recoveryAmount: true,
      },
    }),
    getExceptionCounts(),
  ]);

  return {
    metrics: [
      {
        label: "Draft inspections",
        value: formatCount(draftInspections),
        detail: "Arrival or PDI inspections waiting on completion.",
        href: "/inspections",
      },
      {
        label: "Open claims",
        value: formatCount(openClaims),
        detail: "Warranty claims still moving through the recovery flow.",
        href: "/warranty",
      },
      {
        label: "Recovered this month",
        value: formatCurrency(recovered._sum.recoveryAmount ?? 0),
        detail: "Warranty dollars recovered since the start of the month.",
        href: "/warranty",
      },
      {
        label: "Data exceptions",
        value: formatCount(exceptionCounts.total),
        detail: "Cross-module records that need cleanup or assignment.",
        href: "/admin/exceptions",
      },
    ],
    rows: [
      makeSummaryRow("Customers without contacts", exceptionCounts.customersWithoutContacts, "Accounts that still need a reachable human."),
      makeSummaryRow("Stale quotes + estimates", exceptionCounts.staleQuotes + exceptionCounts.staleEstimates, "Draft or sent offers older than the service window."),
      makeSummaryRow("Expired access tokens", exceptionCounts.expiredPortalTokens + exceptionCounts.expiredVideoShareLinks, "Portal and video links that should be renewed or revoked."),
      makeSummaryRow("Open work without tech", exceptionCounts.openWorkOrdersWithoutTech, "Jobs on the board that still need ownership."),
    ],
  };
}

async function getCloseoutOverview() {
  const monthStart = startOfMonth(new Date());

  const [readyToBillWorkOrders, approvedEstimateSum, approvedChangeOrderSum, recoveredSum] =
    await Promise.all([
      db.workOrder.findMany({
        where: {
          deletedAt: null,
          status: WorkOrderStatus.READY_TO_BILL,
        },
        select: {
          id: true,
          workOrderNumber: true,
          customer: {
            select: {
              displayName: true,
            },
          },
          updatedAt: true,
          lineItems: {
            where: { deletedAt: null },
            select: { lineTotal: true },
          },
        },
        orderBy: [{ updatedAt: "asc" }, { id: "desc" }],
        take: 5,
      }),
      db.estimate.aggregate({
        where: {
          deletedAt: null,
          status: "APPROVED",
          approvedAt: { gte: monthStart },
        },
        _sum: { total: true },
      }),
      db.changeOrder.aggregate({
        where: {
          deletedAt: null,
          status: "APPROVED",
          approvedAt: { gte: monthStart },
        },
        _sum: { total: true },
      }),
      db.warrantyClaim.aggregate({
        where: {
          deletedAt: null,
          status: "RECOVERED",
          resolvedAt: { gte: monthStart },
        },
        _sum: { recoveryAmount: true },
      }),
    ]);

  const readyToBillRows = readyToBillWorkOrders.map((wo) => {
    const subtotal = wo.lineItems.reduce((total, line) => total + toNumber(line.lineTotal), 0);
    return {
      label: wo.workOrderNumber,
      value: formatCurrency(subtotal),
      detail: `${wo.customer.displayName} | Idle ${formatCount(Math.max(0, differenceInCalendarDays(new Date(), wo.updatedAt)))}d`,
      href: `/work-orders/${wo.id}`,
    };
  });

  const readyToBillCount = await db.workOrder.count({
    where: {
      deletedAt: null,
      status: WorkOrderStatus.READY_TO_BILL,
    },
  });

  return {
    metrics: [
      {
        label: "Ready to bill",
        value: formatCount(readyToBillCount),
        detail: "Work orders currently sitting in READY_TO_BILL.",
        href: "/reports/closeout",
      },
      {
        label: "Approved estimates (MTD)",
        value: formatCurrency(approvedEstimateSum._sum.total ?? 0),
        detail: "Approved estimate totals since the start of the month.",
        href: "/reports/closeout",
      },
      {
        label: "Approved change orders (MTD)",
        value: formatCurrency(approvedChangeOrderSum._sum.total ?? 0),
        detail: "Approved change-order totals since the start of the month.",
        href: "/reports/closeout",
      },
      {
        label: "Recovered (MTD)",
        value: formatCurrency(recoveredSum._sum.recoveryAmount ?? 0),
        detail: "Warranty recovery resolved since the start of the month.",
        href: "/reports/closeout",
      },
    ],
    rows: readyToBillRows,
  };
}

async function listWorkOrderRows({
  assignedTechUserId,
  serviceWriterUserId,
  status,
  limit = 5,
}: WorkOrderListFilter): Promise<DashboardRow[]> {
  const statusFilter = Array.isArray(status) ? { in: status } : status;

  const rows = await db.workOrder.findMany({
    where: {
      deletedAt: null,
      ...(assignedTechUserId ? { assignedTechUserId } : {}),
      ...(serviceWriterUserId ? { serviceWriterUserId } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    select: {
      id: true,
      workOrderNumber: true,
      title: true,
      status: true,
      openedAt: true,
      promisedAt: true,
      customer: {
        select: {
          displayName: true,
        },
      },
    },
    orderBy: [{ promisedAt: "asc" }, { openedAt: "asc" }],
    take: limit,
  });

  return rows.map((row) => toWorkOrderRow(row));
}

async function listOpportunityRows({
  ownerUserId,
  stages,
  limit = 5,
}: OpportunityListFilter): Promise<DashboardRow[]> {
  const rows = await db.opportunity.findMany({
    where: {
      deletedAt: null,
      ...(ownerUserId ? { ownerUserId } : {}),
      ...(stages ? { stage: { in: stages } } : {}),
    },
    select: {
      id: true,
      name: true,
      amount: true,
      stage: true,
      customer: {
        select: {
          displayName: true,
        },
      },
      expectedCloseDate: true,
    },
    orderBy: [{ amount: "desc" }, { expectedCloseDate: "asc" }],
    take: limit,
  });

  return rows.map((row) => ({
    label: row.name,
    value: formatCurrency(row.amount),
    detail: `${titleCase(row.stage)} | ${row.customer.displayName}${row.expectedCloseDate ? ` | closes ${formatDate(row.expectedCloseDate)}` : ""}`,
    href: `/sales/opportunities/${row.id}`,
  }));
}

function toWorkOrderRow(row: WorkOrderListRow): DashboardRow {
  return {
    label: row.workOrderNumber,
    value: row.customer.displayName,
    detail: `${titleCase(row.status)} | ${formatRelativeDays(row.openedAt)}${row.promisedAt ? ` | promised ${formatDate(row.promisedAt)}` : ""}`,
    href: `/work-orders/${row.id}`,
  };
}

function stageRank(stage: OpportunityStage) {
  return OPEN_PIPELINE_STAGES.indexOf(stage);
}

function makeSummaryRow(label: string, value: number, detail: string): DashboardRow {
  return {
    label,
    value: formatCount(value),
    detail,
  };
}

function formatRelativeDays(date: Date) {
  const days = Math.max(0, differenceInCalendarDays(new Date(), date));

  if (days === 0) {
    return "opened today";
  }

  if (days === 1) {
    return "opened 1 day ago";
  }

  return `opened ${days} days ago`;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(date);
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDecimal(value: { toNumber(): number } | number | string | null | undefined) {
  const numeric = toNumber(value);

  if (Number.isInteger(numeric)) {
    return formatCount(numeric);
  }

  return numeric.toFixed(1);
}

function formatHours(minutes: number) {
  const hours = minutes / 60;

  if (Number.isInteger(hours)) {
    return `${hours}h`;
  }

  return `${hours.toFixed(1)}h`;
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function trimSentence(value: string | null | undefined) {
  if (!value) {
    return "No extra detail provided.";
  }

  return value.length > 72 ? `${value.slice(0, 69)}...` : value;
}

function formatVehicleLabel(vehicle: {
  year: number | null;
  make: string | null;
  model: string | null;
  unitNumber: string | null;
}) {
  const base = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ");

  if (vehicle.unitNumber) {
    return base ? `${base} | ${vehicle.unitNumber}` : vehicle.unitNumber;
  }

  return base || "Unlabeled vehicle";
}
