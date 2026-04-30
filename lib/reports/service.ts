import { differenceInCalendarDays, differenceInHours, subDays } from "date-fns";
import { WarrantyClaimStatus, WorkOrderStatus } from "@/generated/prisma/client";
import { formatCurrency, toNumber } from "@/lib/core/money";
import { db } from "@/lib/db";
import type { DashboardMetric, DashboardRow } from "@/lib/reports/dashboard";
import { dashboardItemsToRows, type CsvReportSection } from "@/lib/reports/export";

export function buildServiceReportSections(report: ServiceOperationsReport): CsvReportSection[] {
  return [
    { title: "Hero Metrics", rows: dashboardItemsToRows(report.heroMetrics) },
    {
      title: "Report Windows",
      rows: report.windows.map((w) => ({ label: w.label, value: w.detail })),
    },
    { title: "WIP Metrics", rows: dashboardItemsToRows(report.wipMetrics) },
    { title: "WIP Aging", rows: dashboardItemsToRows(report.agingRows) },
    { title: "WIP Status Mix", rows: dashboardItemsToRows(report.statusRows) },
    { title: "Oldest Active Work Orders", rows: dashboardItemsToRows(report.oldestRows) },
    { title: "Actual vs Estimate", rows: dashboardItemsToRows(report.actualEstimateMetrics) },
    {
      title: "Actual vs Estimate — Recent Work Orders",
      rows: dashboardItemsToRows(report.actualEstimateRows),
    },
    { title: "Cycle Time", rows: dashboardItemsToRows(report.cycleMetrics) },
    { title: "Cycle Time by Stage", rows: dashboardItemsToRows(report.cycleStageRows) },
    { title: "Recently Closed Work Orders", rows: dashboardItemsToRows(report.cycleRecentRows) },
    { title: "Technician Capture", rows: dashboardItemsToRows(report.technicianMetrics) },
    { title: "Technician Rows", rows: dashboardItemsToRows(report.technicianRows) },
    { title: "QC Load", rows: dashboardItemsToRows(report.qcMetrics) },
    { title: "QC Queue", rows: dashboardItemsToRows(report.qcRows) },
    { title: "Inspections", rows: dashboardItemsToRows(report.inspectionRows) },
  ];
}

const ACTIVE_WORK_ORDER_STATUSES: WorkOrderStatus[] = [
  WorkOrderStatus.OPEN,
  WorkOrderStatus.IN_PROGRESS,
  WorkOrderStatus.ON_HOLD_PARTS,
  WorkOrderStatus.ON_HOLD_DELAY,
  WorkOrderStatus.QC,
  WorkOrderStatus.READY_TO_BILL,
];

const HOLD_WORK_ORDER_STATUSES: WorkOrderStatus[] = [
  WorkOrderStatus.ON_HOLD_PARTS,
  WorkOrderStatus.ON_HOLD_DELAY,
];

const WARRANTY_RISK_STATUSES: WarrantyClaimStatus[] = [
  WarrantyClaimStatus.OPEN,
  WarrantyClaimStatus.SUBMITTED,
  WarrantyClaimStatus.APPROVED,
];

const CYCLE_WINDOW_DAYS = 30;
const TECH_WINDOW_DAYS = 30;
const COMPLETED_INSPECTION_WINDOW_DAYS = 7;
const ACTUAL_ESTIMATE_WINDOW_DAYS = 90;

export type ServiceReportWindow = {
  label: string;
  detail: string;
};

export type ServiceOperationsReport = {
  windows: ServiceReportWindow[];
  heroMetrics: DashboardMetric[];
  wipMetrics: DashboardMetric[];
  agingRows: DashboardRow[];
  statusRows: DashboardRow[];
  oldestRows: DashboardRow[];
  actualEstimateMetrics: DashboardMetric[];
  actualEstimateRows: DashboardRow[];
  cycleMetrics: DashboardMetric[];
  cycleStageRows: DashboardRow[];
  cycleRecentRows: DashboardRow[];
  technicianMetrics: DashboardMetric[];
  technicianRows: DashboardRow[];
  qcMetrics: DashboardMetric[];
  qcRows: DashboardRow[];
  inspectionRows: DashboardRow[];
};

export async function getServiceOperationsReport(): Promise<ServiceOperationsReport> {
  const now = new Date();
  const cycleWindowStart = subDays(now, CYCLE_WINDOW_DAYS);
  const techWindowStart = subDays(now, TECH_WINDOW_DAYS);
  const inspectionWindowStart = subDays(now, COMPLETED_INSPECTION_WINDOW_DAYS);
  const estimateWindowStart = subDays(now, ACTUAL_ESTIMATE_WINDOW_DAYS);

  const [
    activeWorkOrders,
    estimateComparisons,
    closedWorkOrders,
    timeEntries,
    qcQueue,
    draftInspections,
    completedInspectionsLast7Days,
    openWarrantyClaims,
  ] = await Promise.all([
    db.workOrder.findMany({
      where: {
        deletedAt: null,
        status: { in: ACTIVE_WORK_ORDER_STATUSES },
      },
      select: {
        id: true,
        workOrderNumber: true,
        title: true,
        status: true,
        openedAt: true,
        promisedAt: true,
        assignedTechUserId: true,
        customer: {
          select: {
            displayName: true,
          },
        },
      },
      orderBy: [{ openedAt: "asc" }],
    }),
    db.estimate.findMany({
      where: {
        deletedAt: null,
        convertedWorkOrderId: { not: null },
        convertedWorkOrder: {
          is: {
            deletedAt: null,
            openedAt: { gte: estimateWindowStart },
          },
        },
      },
      select: {
        id: true,
        estimateNumber: true,
        total: true,
        customer: {
          select: {
            displayName: true,
          },
        },
        convertedWorkOrder: {
          select: {
            id: true,
            workOrderNumber: true,
            status: true,
            openedAt: true,
            lineItems: {
              where: { deletedAt: null },
              select: {
                lineTotal: true,
              },
            },
          },
        },
      },
    }),
    db.workOrder.findMany({
      where: {
        deletedAt: null,
        closedAt: { gte: cycleWindowStart },
      },
      select: {
        id: true,
        workOrderNumber: true,
        title: true,
        openedAt: true,
        closedAt: true,
        customer: {
          select: {
            displayName: true,
          },
        },
        statusHistory: {
          orderBy: { createdAt: "asc" },
          select: {
            toStatus: true,
            createdAt: true,
          },
        },
      },
      orderBy: { closedAt: "desc" },
    }),
    db.timeEntry.findMany({
      where: {
        deletedAt: null,
        startedAt: { gte: techWindowStart },
        user: { deletedAt: null },
      },
      select: {
        id: true,
        userId: true,
        durationMinutes: true,
        billableMinutes: true,
        goodwillMinutes: true,
        status: true,
        user: {
          select: {
            email: true,
          },
        },
      },
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
        openedAt: true,
        promisedAt: true,
        customer: {
          select: {
            displayName: true,
          },
        },
        statusHistory: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            toStatus: true,
            createdAt: true,
          },
        },
      },
      orderBy: [{ promisedAt: "asc" }, { openedAt: "asc" }],
    }),
    db.arrivalInspection.findMany({
      where: {
        deletedAt: null,
        status: "DRAFT",
      },
      select: {
        id: true,
        type: true,
        createdAt: true,
        customer: {
          select: {
            displayName: true,
          },
        },
        vehicle: {
          select: {
            year: true,
            make: true,
            model: true,
            unitNumber: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 8,
    }),
    db.arrivalInspection.count({
      where: {
        deletedAt: null,
        status: "COMPLETE",
        performedAt: { gte: inspectionWindowStart },
      },
    }),
    db.warrantyClaim.count({
      where: {
        deletedAt: null,
        status: { in: WARRANTY_RISK_STATUSES },
      },
    }),
  ]);

  const wipAgedCount = activeWorkOrders.filter((workOrder) => ageInDays(workOrder.openedAt, now) >= 8).length;
  const onHoldCount = activeWorkOrders.filter((workOrder) => HOLD_WORK_ORDER_STATUSES.includes(workOrder.status)).length;
  const unassignedCount = activeWorkOrders.filter((workOrder) => !workOrder.assignedTechUserId).length;

  const cycleDurationsInHours = closedWorkOrders
    .filter((workOrder) => !!workOrder.closedAt)
    .map((workOrder) => differenceInHours(workOrder.closedAt as Date, workOrder.openedAt));
  const averageCycleHours = average(cycleDurationsInHours);

  const reportTimeEntries = timeEntries.filter((entry) => entry.durationMinutes > 0);
  const trackedMinutes = reportTimeEntries.reduce((sum, entry) => sum + entry.durationMinutes, 0);
  const billableMinutes = reportTimeEntries.reduce((sum, entry) => sum + entry.billableMinutes, 0);
  const goodwillMinutes = reportTimeEntries.reduce((sum, entry) => sum + entry.goodwillMinutes, 0);

  const heroMetrics: DashboardMetric[] = [
    {
      label: "Active WIP",
      value: formatCount(activeWorkOrders.length),
      detail: "Live work orders in service, hold, QC, or ready-to-bill states.",
      href: "#wip-aging",
    },
    {
      label: "8+ day jobs",
      value: formatCount(wipAgedCount),
      detail: "Active work orders opened at least eight calendar days ago.",
      href: "#wip-aging",
    },
    {
      label: "Avg cycle time",
      value: formatDaysFromHours(averageCycleHours),
      detail: `Closed work orders over the last ${CYCLE_WINDOW_DAYS} days.`,
      href: "#cycle-time",
    },
    {
      label: "Billable capture",
      value: formatPercent(trackedMinutes === 0 ? 0 : billableMinutes / trackedMinutes),
      detail: `Billable minutes divided by tracked minutes over the last ${TECH_WINDOW_DAYS} days.`,
      href: "#tech-utilization",
    },
  ];

  const wipMetrics: DashboardMetric[] = [
    {
      label: "Active work orders",
      value: formatCount(activeWorkOrders.length),
      detail: "Current WIP across all active service statuses.",
    },
    {
      label: "8+ day jobs",
      value: formatCount(wipAgedCount),
      detail: "Active jobs that are already moving into exception territory.",
    },
    {
      label: "On hold",
      value: formatCount(onHoldCount),
      detail: "Jobs paused on parts or delay-related holds.",
    },
    {
      label: "Unassigned",
      value: formatCount(unassignedCount),
      detail: "Active jobs that still do not have a technician assigned.",
    },
  ];

  const agingRows: DashboardRow[] = [
    makeSummaryRow("0-2 days", activeWorkOrders.filter((workOrder) => ageInDays(workOrder.openedAt, now) <= 2).length, "Freshly opened or recently started work."),
    makeSummaryRow("3-7 days", activeWorkOrders.filter((workOrder) => {
      const days = ageInDays(workOrder.openedAt, now);
      return days >= 3 && days <= 7;
    }).length, "Mid-cycle work that should still have momentum."),
    makeSummaryRow("8-14 days", activeWorkOrders.filter((workOrder) => {
      const days = ageInDays(workOrder.openedAt, now);
      return days >= 8 && days <= 14;
    }).length, "Active jobs that are aging toward escalation."),
    makeSummaryRow("15+ days", activeWorkOrders.filter((workOrder) => ageInDays(workOrder.openedAt, now) >= 15).length, "Long-running active work orders that deserve review."),
  ];

  const statusRows: DashboardRow[] = [
    makeSummaryRow("Open", activeWorkOrders.filter((workOrder) => workOrder.status === WorkOrderStatus.OPEN).length, "New jobs that have not started active execution."),
    makeSummaryRow("In progress", activeWorkOrders.filter((workOrder) => workOrder.status === WorkOrderStatus.IN_PROGRESS).length, "Jobs actively being worked."),
    makeSummaryRow("Hold - parts", activeWorkOrders.filter((workOrder) => workOrder.status === WorkOrderStatus.ON_HOLD_PARTS).length, "Paused while waiting on stock or procurement."),
    makeSummaryRow("Hold - delay", activeWorkOrders.filter((workOrder) => workOrder.status === WorkOrderStatus.ON_HOLD_DELAY).length, "Paused on customer, vendor, or other delay."),
    makeSummaryRow("QC", activeWorkOrders.filter((workOrder) => workOrder.status === WorkOrderStatus.QC).length, "Jobs waiting in the quality lane."),
    makeSummaryRow("Ready to bill", activeWorkOrders.filter((workOrder) => workOrder.status === WorkOrderStatus.READY_TO_BILL).length, "Jobs staged for billing or administrative closeout."),
  ];

  const oldestRows = activeWorkOrders.slice(0, 8).map((workOrder) => ({
    label: workOrder.workOrderNumber,
    value: titleCase(workOrder.status),
    detail: `${workOrder.customer.displayName} | ${formatOpenedRelativeDays(workOrder.openedAt, now)}${workOrder.promisedAt ? ` | promised ${formatDate(workOrder.promisedAt)}` : ""}`,
    href: `/work-orders/${workOrder.id}`,
  }));

  const estimateRows = estimateComparisons.map((estimate) => {
    const workOrder = estimate.convertedWorkOrder;
    const actualSubtotal = sumLineTotals(workOrder?.lineItems ?? []);
    const estimateTotal = toNumber(estimate.total);
    const variance = actualSubtotal - estimateTotal;

    return {
      id: workOrder?.id ?? estimate.id,
      workOrderNumber: workOrder?.workOrderNumber ?? "Unlinked work order",
      estimateNumber: estimate.estimateNumber,
      customerName: estimate.customer.displayName,
      estimateTotal,
      actualSubtotal,
      variance,
      status: workOrder?.status ?? WorkOrderStatus.OPEN,
      openedAt: workOrder?.openedAt ?? now,
    };
  });

  const actualEstimateMetrics: DashboardMetric[] = [
    {
      label: "Converted work orders",
      value: formatCount(estimateRows.length),
      detail: `Source estimates converted in the last ${ACTUAL_ESTIMATE_WINDOW_DAYS} days.`,
    },
    {
      label: "Estimated total",
      value: formatCurrency(estimateRows.reduce((sum, row) => sum + row.estimateTotal, 0)),
      detail: "Original estimate totals from the source estimate record.",
    },
    {
      label: "Current actual total",
      value: formatCurrency(estimateRows.reduce((sum, row) => sum + row.actualSubtotal, 0)),
      detail: "Current subtotal from active work-order line items.",
    },
    {
      label: "Net variance",
      value: formatSignedCurrency(estimateRows.reduce((sum, row) => sum + row.variance, 0)),
      detail: "Current actual subtotal minus source estimate total.",
    },
  ];

  const actualEstimateRows: DashboardRow[] = estimateRows
    .sort((left, right) => Math.abs(right.variance) - Math.abs(left.variance))
    .slice(0, 8)
    .map((row) => ({
      label: `${row.workOrderNumber} vs ${row.estimateNumber}`,
      value: formatSignedCurrency(row.variance),
      detail: `${row.customerName} | est ${formatCurrency(row.estimateTotal)} | actual ${formatCurrency(row.actualSubtotal)} | ${titleCase(row.status)}`,
      href: `/work-orders/${row.id}`,
    }));

  const quickTurnCount = cycleDurationsInHours.filter((hours) => hours <= 48).length;
  const longCycleCount = cycleDurationsInHours.filter((hours) => hours >= 168).length;

  const cycleMetrics: DashboardMetric[] = [
    {
      label: "Closed work orders",
      value: formatCount(closedWorkOrders.length),
      detail: `Closed during the last ${CYCLE_WINDOW_DAYS} days.`,
    },
    {
      label: "Avg cycle time",
      value: formatDaysFromHours(averageCycleHours),
      detail: "From `openedAt` to `closedAt` on closed work orders.",
    },
    {
      label: "Quick turns",
      value: formatCount(quickTurnCount),
      detail: "Closed in two days or less during the cycle window.",
    },
    {
      label: "7+ day closures",
      value: formatCount(longCycleCount),
      detail: "Closed work orders that took at least seven days end to end.",
    },
  ];

  const segmentDurations = new Map<WorkOrderStatus, number[]>();

  for (const workOrder of closedWorkOrders) {
    if (!workOrder.closedAt || workOrder.statusHistory.length === 0) {
      continue;
    }

    for (let index = 0; index < workOrder.statusHistory.length; index += 1) {
      const current = workOrder.statusHistory[index];

      if (current.toStatus === WorkOrderStatus.CLOSED) {
        continue;
      }

      const next = workOrder.statusHistory[index + 1];
      const end = next?.createdAt ?? workOrder.closedAt;
      const durationHours = Math.max(0, differenceInHours(end, current.createdAt));

      if (!segmentDurations.has(current.toStatus)) {
        segmentDurations.set(current.toStatus, []);
      }

      segmentDurations.get(current.toStatus)?.push(durationHours);
    }
  }

  const cycleStageOrder: WorkOrderStatus[] = [
    WorkOrderStatus.OPEN,
    WorkOrderStatus.IN_PROGRESS,
    WorkOrderStatus.ON_HOLD_PARTS,
    WorkOrderStatus.ON_HOLD_DELAY,
    WorkOrderStatus.QC,
    WorkOrderStatus.READY_TO_BILL,
  ];

  const cycleStageRows: DashboardRow[] = cycleStageOrder
    .filter((status) => (segmentDurations.get(status)?.length ?? 0) > 0)
    .map((status) => {
      const durations = segmentDurations.get(status) ?? [];
      return {
        label: titleCase(status),
        value: formatHours(average(durations)),
        detail: `Average dwell across ${formatCount(durations.length)} transitions in closed work orders.`,
      };
    });

  const cycleRecentRows: DashboardRow[] = closedWorkOrders.slice(0, 8).map((workOrder) => ({
    label: workOrder.workOrderNumber,
    value: formatDaysFromHours(differenceInHours(workOrder.closedAt as Date, workOrder.openedAt)),
    detail: `${workOrder.customer.displayName} | closed ${formatDate(workOrder.closedAt as Date)} | ${trimSentence(workOrder.title)}`,
    href: `/work-orders/${workOrder.id}`,
  }));

  const timeRows = new Map<string, {
    email: string;
    trackedMinutes: number;
    billableMinutes: number;
    goodwillMinutes: number;
    entryCount: number;
  }>();

  for (const entry of reportTimeEntries) {
    const existing = timeRows.get(entry.userId) ?? {
      email: entry.user?.email ?? "Unknown user",
      trackedMinutes: 0,
      billableMinutes: 0,
      goodwillMinutes: 0,
      entryCount: 0,
    };

    existing.trackedMinutes += entry.durationMinutes;
    existing.billableMinutes += entry.billableMinutes;
    existing.goodwillMinutes += entry.goodwillMinutes;
    existing.entryCount += 1;

    timeRows.set(entry.userId, existing);
  }

  const perTechRows = Array.from(timeRows.values()).sort((left, right) => {
    if (right.billableMinutes !== left.billableMinutes) {
      return right.billableMinutes - left.billableMinutes;
    }

    return right.trackedMinutes - left.trackedMinutes;
  });

  const technicianMetrics: DashboardMetric[] = [
    {
      label: "Tracked hours",
      value: formatHours(trackedMinutes / 60),
      detail: `Duration minutes logged over the last ${TECH_WINDOW_DAYS} days.`,
    },
    {
      label: "Billable hours",
      value: formatHours(billableMinutes / 60),
      detail: "Billable minutes logged over the same 30-day window.",
    },
    {
      label: "Billable capture",
      value: formatPercent(trackedMinutes === 0 ? 0 : billableMinutes / trackedMinutes),
      detail: "`billableMinutes / durationMinutes` across the report window.",
    },
    {
      label: "Goodwill rate",
      value: formatPercent(trackedMinutes === 0 ? 0 : goodwillMinutes / trackedMinutes),
      detail: "`goodwillMinutes / durationMinutes` across the report window.",
    },
  ];

  const technicianRows: DashboardRow[] = perTechRows.map((row) => ({
    label: row.email,
    value: `${formatHours(row.billableMinutes / 60)} billable`,
    detail: `${formatHours(row.trackedMinutes / 60)} tracked | ${formatPercent(row.trackedMinutes === 0 ? 0 : row.billableMinutes / row.trackedMinutes)} capture | ${formatCount(row.entryCount)} entries`,
  }));

  const qcDurationsInHours = qcQueue.map((workOrder) => {
    const latestHistory = workOrder.statusHistory[0];
    const enteredQcAt =
      latestHistory && latestHistory.toStatus === WorkOrderStatus.QC
        ? latestHistory.createdAt
        : workOrder.openedAt;

    return Math.max(0, differenceInHours(now, enteredQcAt));
  });

  const qcMetrics: DashboardMetric[] = [
    {
      label: "QC queue",
      value: formatCount(qcQueue.length),
      detail: "Work orders currently sitting in the QC status lane.",
    },
    {
      label: "Avg time in QC",
      value: formatHours(average(qcDurationsInHours)),
      detail: "From the latest QC status change until now.",
    },
    {
      label: "Draft inspections",
      value: formatCount(draftInspections.length),
      detail: "Arrival or PDI inspections still waiting on completion.",
    },
    {
      label: "Completed inspections",
      value: formatCount(completedInspectionsLast7Days),
      detail: `Inspections completed in the last ${COMPLETED_INSPECTION_WINDOW_DAYS} days.`,
    },
    {
      label: "Open warranty risk",
      value: formatCount(openWarrantyClaims),
      detail: "Warranty claims still open, submitted, or approved.",
    },
  ];

  const qcRows: DashboardRow[] = qcQueue.map((workOrder) => {
    const latestHistory = workOrder.statusHistory[0];
    const enteredQcAt =
      latestHistory && latestHistory.toStatus === WorkOrderStatus.QC
        ? latestHistory.createdAt
        : workOrder.openedAt;

    return {
      label: workOrder.workOrderNumber,
      value: formatHours(Math.max(0, differenceInHours(now, enteredQcAt))),
      detail: `${workOrder.customer.displayName} | ${trimSentence(workOrder.title)}${workOrder.promisedAt ? ` | promised ${formatDate(workOrder.promisedAt)}` : ""}`,
      href: `/work-orders/${workOrder.id}`,
    };
  });

  const inspectionRows: DashboardRow[] = draftInspections.map((inspection) => ({
    label: `${titleCase(inspection.type)} | ${formatVehicleLabel(inspection.vehicle)}`,
    value: formatStartedRelativeDays(inspection.createdAt, now),
    detail: `${inspection.customer.displayName} | draft inspection waiting on completion`,
    href: `/inspections/${inspection.id}`,
  }));

  return {
    windows: [
      {
        label: "Live WIP",
        detail: "Active work orders right now (`OPEN` through `READY_TO_BILL`).",
      },
      {
        label: "Cycle window",
        detail: `Closed work orders with \`closedAt\` in the last ${CYCLE_WINDOW_DAYS} days.`,
      },
      {
        label: "Tech window",
        detail: `Time entries with \`startedAt\` in the last ${TECH_WINDOW_DAYS} days.`,
      },
      {
        label: "Actual vs estimate",
        detail: `Converted estimates whose work orders opened in the last ${ACTUAL_ESTIMATE_WINDOW_DAYS} days.`,
      },
      {
        label: "Inspection completions",
        detail: `Completed inspections with \`performedAt\` in the last ${COMPLETED_INSPECTION_WINDOW_DAYS} days.`,
      },
    ],
    heroMetrics,
    wipMetrics,
    agingRows,
    statusRows,
    oldestRows,
    actualEstimateMetrics,
    actualEstimateRows,
    cycleMetrics,
    cycleStageRows,
    cycleRecentRows,
    technicianMetrics,
    technicianRows,
    qcMetrics,
    qcRows,
    inspectionRows,
  };
}

function makeSummaryRow(label: string, count: number, detail: string): DashboardRow {
  return {
    label,
    value: formatCount(count),
    detail,
  };
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function ageInDays(date: Date, now: Date) {
  return Math.max(0, differenceInCalendarDays(now, date));
}

function sumLineTotals(
  lineItems: Array<{ lineTotal: number | string | { toNumber(): number } | null | undefined }>,
) {
  return lineItems.reduce((sum, lineItem) => sum + toNumber(lineItem.lineTotal), 0);
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatHours(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0h";
  }

  if (value >= 24) {
    return `${value.toFixed(1)}h`;
  }

  if (Number.isInteger(value)) {
    return `${value}h`;
  }

  return `${value.toFixed(1)}h`;
}

function formatDaysFromHours(hours: number) {
  if (!Number.isFinite(hours) || hours <= 0) {
    return "0d";
  }

  const days = hours / 24;

  if (Number.isInteger(days)) {
    return `${days}d`;
  }

  return `${days.toFixed(1)}d`;
}

function formatSignedCurrency(value: number) {
  const abs = formatCurrency(Math.abs(value));

  if (value > 0) {
    return `+${abs}`;
  }

  if (value < 0) {
    return `-${abs}`;
  }

  return abs;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(date);
}

function formatStartedRelativeDays(date: Date, now: Date) {
  const days = ageInDays(date, now);

  if (days === 0) {
    return "started today";
  }

  if (days === 1) {
    return "started 1 day ago";
  }

  return `started ${days} days ago`;
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

function formatOpenedRelativeDays(date: Date, now: Date) {
  const days = ageInDays(date, now);

  if (days === 0) {
    return "opened today";
  }

  if (days === 1) {
    return "opened 1 day ago";
  }

  return `opened ${days} days ago`;
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

  return value.length > 78 ? `${value.slice(0, 75)}...` : value;
}
