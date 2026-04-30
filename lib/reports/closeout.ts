import { differenceInCalendarDays, subDays } from "date-fns";
import {
  ChangeOrderStatus,
  EstimateStatus,
  WarrantyClaimStatus,
  WorkOrderStatus,
} from "@/generated/prisma/client";
import { formatCurrency, toNumber } from "@/lib/core/money";
import { db } from "@/lib/db";
import type { DashboardMetric, DashboardRow } from "@/lib/reports/dashboard";
import { dashboardItemsToRows, type CsvReportSection } from "@/lib/reports/export";

export function buildCloseoutReportSections(report: CloseoutReport): CsvReportSection[] {
  return [
    {
      title: "Scope",
      rows: [
        { label: "Report", value: report.title },
        { label: "Description", value: report.description },
      ],
    },
    {
      title: "Report Windows",
      rows: report.windows.map((w) => ({ label: w.label, value: w.detail })),
    },
    { title: "Hero Metrics", rows: dashboardItemsToRows(report.heroMetrics) },
    { title: "Ready-to-Bill Metrics", rows: dashboardItemsToRows(report.readyToBillMetrics) },
    { title: "Ready-to-Bill Rows", rows: dashboardItemsToRows(report.readyToBillRows) },
    { title: "Approval Metrics", rows: dashboardItemsToRows(report.approvedMetrics) },
    { title: "Approved Estimates", rows: dashboardItemsToRows(report.approvedEstimateRows) },
    { title: "Approved Change Orders", rows: dashboardItemsToRows(report.approvedChangeOrderRows) },
    { title: "Warranty Recovery Metrics", rows: dashboardItemsToRows(report.warrantyMetrics) },
    { title: "Recovered Warranty Claims", rows: dashboardItemsToRows(report.warrantyRows) },
  ];
}

const APPROVAL_WINDOW_DAYS = 30;
const RECOVERY_WINDOW_DAYS = 90;
const TOP_ROW_LIMIT = 10;

export type CloseoutReportWindow = {
  label: string;
  detail: string;
};

export type CloseoutReport = {
  title: string;
  description: string;
  windows: CloseoutReportWindow[];
  heroMetrics: DashboardMetric[];
  readyToBillMetrics: DashboardMetric[];
  readyToBillRows: DashboardRow[];
  approvedMetrics: DashboardMetric[];
  approvedEstimateRows: DashboardRow[];
  approvedChangeOrderRows: DashboardRow[];
  warrantyMetrics: DashboardMetric[];
  warrantyRows: DashboardRow[];
};

export async function getCloseoutReport(): Promise<CloseoutReport> {
  const now = new Date();
  const approvalWindowStart = subDays(now, APPROVAL_WINDOW_DAYS);
  const recoveryWindowStart = subDays(now, RECOVERY_WINDOW_DAYS);

  const [
    readyToBillWorkOrders,
    approvedEstimates,
    approvedChangeOrders,
    warrantyRecoveredClaims,
    warrantyExposureClaims,
  ] = await Promise.all([
    db.workOrder.findMany({
      where: {
        deletedAt: null,
        status: WorkOrderStatus.READY_TO_BILL,
      },
      select: {
        id: true,
        workOrderNumber: true,
        title: true,
        promisedAt: true,
        openedAt: true,
        updatedAt: true,
        customer: {
          select: {
            displayName: true,
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
      },
      orderBy: [{ updatedAt: "asc" }, { id: "desc" }],
    }),
    db.estimate.findMany({
      where: {
        deletedAt: null,
        status: EstimateStatus.APPROVED,
        approvedAt: { gte: approvalWindowStart },
      },
      select: {
        id: true,
        estimateNumber: true,
        title: true,
        total: true,
        approvedAt: true,
        customer: {
          select: {
            displayName: true,
          },
        },
      },
      orderBy: [{ total: "desc" }, { id: "desc" }],
    }),
    db.changeOrder.findMany({
      where: {
        deletedAt: null,
        status: ChangeOrderStatus.APPROVED,
        approvedAt: { gte: approvalWindowStart },
      },
      select: {
        id: true,
        changeOrderNumber: true,
        title: true,
        total: true,
        approvedAt: true,
        workOrder: {
          select: {
            id: true,
            workOrderNumber: true,
            customer: {
              select: {
                displayName: true,
              },
            },
          },
        },
      },
      orderBy: [{ total: "desc" }, { id: "desc" }],
    }),
    db.warrantyClaim.findMany({
      where: {
        deletedAt: null,
        status: WarrantyClaimStatus.RECOVERED,
        resolvedAt: { gte: recoveryWindowStart },
      },
      select: {
        id: true,
        title: true,
        claimNumber: true,
        recoveryAmount: true,
        resolvedAt: true,
        workOrder: {
          select: {
            id: true,
            workOrderNumber: true,
            customer: {
              select: {
                displayName: true,
              },
            },
          },
        },
        vendor: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ resolvedAt: "desc" }, { id: "desc" }],
    }),
    db.warrantyClaim.findMany({
      where: {
        deletedAt: null,
        status: {
          in: [
            WarrantyClaimStatus.OPEN,
            WarrantyClaimStatus.SUBMITTED,
            WarrantyClaimStatus.APPROVED,
          ],
        },
      },
      select: {
        id: true,
        status: true,
        title: true,
        claimNumber: true,
        recoveryAmount: true,
        submittedAt: true,
      },
    }),
  ]);

  const readyToBillTotals = readyToBillWorkOrders.map((wo) => ({
    ...wo,
    subtotal: wo.lineItems.reduce((total, line) => total + toNumber(line.lineTotal), 0),
  }));

  const readyToBillTotalValue = readyToBillTotals.reduce((total, wo) => total + wo.subtotal, 0);
  const readyToBillCount = readyToBillTotals.length;

  const oldestReadyToBillDays = readyToBillTotals.length
    ? Math.max(
        ...readyToBillTotals.map((wo) =>
          Math.max(0, differenceInCalendarDays(now, wo.updatedAt)),
        ),
      )
    : 0;

  const approvedEstimateTotal = approvedEstimates.reduce(
    (total, estimate) => total + toNumber(estimate.total),
    0,
  );
  const approvedChangeOrderTotal = approvedChangeOrders.reduce(
    (total, order) => total + toNumber(order.total),
    0,
  );

  const warrantyRecoveredTotal = warrantyRecoveredClaims.reduce(
    (total, claim) => total + toNumber(claim.recoveryAmount),
    0,
  );
  const warrantyExposureTotal = warrantyExposureClaims.reduce(
    (total, claim) => total + toNumber(claim.recoveryAmount),
    0,
  );

  const openWarrantyCount = warrantyExposureClaims.length;

  return {
    title: "Financial Closeout Report",
    description:
      "Closeout focuses on money that is earned or recoverable but not yet booked: work orders sitting in ready-to-bill, approved estimate and change-order totals in the current approval window, and warranty recovery activity over the recovery window.",
    windows: [
      {
        label: "Ready-to-bill",
        detail: "Ready-to-bill pulls every work order currently in the READY_TO_BILL status, regardless of age.",
      },
      {
        label: "Approval window",
        detail: `Approved estimate and change-order totals use the last ${APPROVAL_WINDOW_DAYS} days of approval activity.`,
      },
      {
        label: "Recovery window",
        detail: `Warranty recovery uses claims resolved in the last ${RECOVERY_WINDOW_DAYS} days.`,
      },
    ],
    heroMetrics: [
      {
        label: "Ready to bill",
        value: formatCount(readyToBillCount),
        detail: "Work orders currently sitting in READY_TO_BILL.",
        href: "/work-orders",
      },
      {
        label: "Ready-to-bill value",
        value: formatCurrency(readyToBillTotalValue),
        detail: "Sum of work-order line item subtotals in the ready-to-bill queue.",
      },
      {
        label: `Approved (${APPROVAL_WINDOW_DAYS}d)`,
        value: formatCurrency(approvedEstimateTotal + approvedChangeOrderTotal),
        detail: "Approved estimate + change-order totals in the approval window.",
      },
      {
        label: `Recovered (${RECOVERY_WINDOW_DAYS}d)`,
        value: formatCurrency(warrantyRecoveredTotal),
        detail: "Warranty recovery amounts resolved in the recovery window.",
      },
    ],
    readyToBillMetrics: [
      {
        label: "Ready-to-bill count",
        value: formatCount(readyToBillCount),
        detail: "Count of work orders in READY_TO_BILL right now.",
      },
      {
        label: "Pipeline value",
        value: formatCurrency(readyToBillTotalValue),
        detail: "Line item subtotal sum across the ready-to-bill queue.",
      },
      {
        label: "Oldest ready-to-bill",
        value: readyToBillTotals.length
          ? `${formatCount(oldestReadyToBillDays)}d`
          : "0d",
        detail: "Days since the oldest ready-to-bill work order last changed.",
      },
    ],
    readyToBillRows: readyToBillTotals.slice(0, TOP_ROW_LIMIT).map((wo) => ({
      label: wo.workOrderNumber,
      value: formatCurrency(wo.subtotal),
      detail: buildReadyToBillDetail(wo, now),
      href: `/work-orders/${wo.id}`,
    })),
    approvedMetrics: [
      {
        label: "Approved estimates",
        value: formatCount(approvedEstimates.length),
        detail: `Estimates with status APPROVED in the last ${APPROVAL_WINDOW_DAYS} days.`,
      },
      {
        label: "Approved estimate value",
        value: formatCurrency(approvedEstimateTotal),
        detail: "Sum of `Estimate.total` for approved estimates in the window.",
      },
      {
        label: "Approved change orders",
        value: formatCount(approvedChangeOrders.length),
        detail: `Change orders with status APPROVED in the last ${APPROVAL_WINDOW_DAYS} days.`,
      },
      {
        label: "Approved change-order value",
        value: formatCurrency(approvedChangeOrderTotal),
        detail: "Sum of `ChangeOrder.total` for approved change orders in the window.",
      },
    ],
    approvedEstimateRows: approvedEstimates.slice(0, TOP_ROW_LIMIT).map((estimate) => ({
      label: estimate.estimateNumber,
      value: formatCurrency(estimate.total),
      detail: buildApprovedEstimateDetail(estimate),
      href: `/sales/estimates/${estimate.id}`,
    })),
    approvedChangeOrderRows: approvedChangeOrders.slice(0, TOP_ROW_LIMIT).map((order) => ({
      label: order.changeOrderNumber,
      value: formatCurrency(order.total),
      detail: buildApprovedChangeOrderDetail(order),
      href: order.workOrder ? `/work-orders/${order.workOrder.id}` : undefined,
    })),
    warrantyMetrics: [
      {
        label: `Recovered (${RECOVERY_WINDOW_DAYS}d)`,
        value: formatCurrency(warrantyRecoveredTotal),
        detail: "Sum of recoveryAmount across RECOVERED claims in the window.",
      },
      {
        label: "Recovered claim count",
        value: formatCount(warrantyRecoveredClaims.length),
        detail: `RECOVERED claims resolved in the last ${RECOVERY_WINDOW_DAYS} days.`,
      },
      {
        label: "Open exposure",
        value: formatCurrency(warrantyExposureTotal),
        detail: "Pending recoveryAmount on OPEN, SUBMITTED, or APPROVED claims.",
      },
      {
        label: "Open claim count",
        value: formatCount(openWarrantyCount),
        detail: "Warranty claims that have not yet resolved.",
      },
    ],
    warrantyRows: warrantyRecoveredClaims.slice(0, TOP_ROW_LIMIT).map((claim) => ({
      label: claim.claimNumber ?? claim.title,
      value: formatCurrency(claim.recoveryAmount),
      detail: buildWarrantyDetail(claim),
      href: claim.workOrder ? `/work-orders/${claim.workOrder.id}` : `/warranty/${claim.id}`,
    })),
  };
}

function buildReadyToBillDetail(
  wo: {
    title: string;
    promisedAt: Date | null;
    openedAt: Date;
    updatedAt: Date;
    customer: { displayName: string };
  },
  now: Date,
) {
  const idleDays = Math.max(0, differenceInCalendarDays(now, wo.updatedAt));
  const ageDays = Math.max(0, differenceInCalendarDays(now, wo.openedAt));
  const promised = wo.promisedAt
    ? `Promised ${wo.promisedAt.toISOString().slice(0, 10)}`
    : "No promise date";
  return `${wo.customer.displayName} | ${wo.title} | Age ${formatCount(ageDays)}d | Idle ${formatCount(idleDays)}d | ${promised}`;
}

function buildApprovedEstimateDetail(estimate: {
  title: string;
  approvedAt: Date | null;
  customer: { displayName: string };
}) {
  const approved = estimate.approvedAt
    ? `Approved ${estimate.approvedAt.toISOString().slice(0, 10)}`
    : "Approved date unknown";
  return `${estimate.customer.displayName} | ${estimate.title} | ${approved}`;
}

function buildApprovedChangeOrderDetail(order: {
  title: string;
  approvedAt: Date | null;
  workOrder: { workOrderNumber: string; customer: { displayName: string } } | null;
}) {
  const approved = order.approvedAt
    ? `Approved ${order.approvedAt.toISOString().slice(0, 10)}`
    : "Approved date unknown";
  if (!order.workOrder) {
    return `${order.title} | ${approved}`;
  }
  return `${order.workOrder.customer.displayName} | WO ${order.workOrder.workOrderNumber} | ${order.title} | ${approved}`;
}

function buildWarrantyDetail(claim: {
  title: string;
  resolvedAt: Date | null;
  workOrder: { workOrderNumber: string; customer: { displayName: string } } | null;
  vendor: { name: string } | null;
}) {
  const resolved = claim.resolvedAt
    ? `Resolved ${claim.resolvedAt.toISOString().slice(0, 10)}`
    : "Resolved date unknown";
  const segments: string[] = [claim.title, resolved];
  if (claim.workOrder) {
    segments.unshift(`WO ${claim.workOrder.workOrderNumber}`);
    segments.unshift(claim.workOrder.customer.displayName);
  }
  if (claim.vendor) {
    segments.push(`Vendor ${claim.vendor.name}`);
  }
  return segments.join(" | ");
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}
