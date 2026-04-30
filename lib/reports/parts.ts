import { differenceInCalendarDays, subDays } from "date-fns";
import { PartTransactionType } from "@/generated/prisma/client";
import { formatCurrency, toNumber } from "@/lib/core/money";
import { db } from "@/lib/db";
import type { DashboardMetric, DashboardRow } from "@/lib/reports/dashboard";

const VELOCITY_WINDOW_DAYS = 30;
const DEAD_STOCK_THRESHOLD_DAYS = 90;
const VENDOR_WINDOW_DAYS = 90;
const TOP_ROW_LIMIT = 10;

export type PartsReportWindow = {
  label: string;
  detail: string;
};

export type PartsInventoryReport = {
  title: string;
  description: string;
  windows: PartsReportWindow[];
  heroMetrics: DashboardMetric[];
  lowStockMetrics: DashboardMetric[];
  lowStockRows: DashboardRow[];
  turnMetrics: DashboardMetric[];
  turnRows: DashboardRow[];
  deadStockMetrics: DashboardMetric[];
  deadStockRows: DashboardRow[];
  vendorMetrics: DashboardMetric[];
  vendorRows: DashboardRow[];
};

type IssueAccumulator = {
  quantity: number;
  lastIssuedAt: Date | null;
};

type VendorAccumulator = {
  id: string;
  name: string;
  receiveCount: number;
  quantityReceived: number;
  lastReceivedAt: Date | null;
};

export async function getPartsInventoryReport(): Promise<PartsInventoryReport> {
  const now = new Date();
  const velocityWindowStart = subDays(now, VELOCITY_WINDOW_DAYS);
  const vendorWindowStart = subDays(now, VENDOR_WINDOW_DAYS);

  const [parts, issueTransactions, vendorReceives] = await Promise.all([
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
        unitCost: true,
        updatedAt: true,
        vendor: {
          select: {
            id: true,
            name: true,
          },
        },
        category: {
          select: {
            name: true,
          },
        },
      },
    }),
    db.partTransaction.findMany({
      where: {
        type: PartTransactionType.ISSUE,
        occurredAt: { gte: velocityWindowStart },
      },
      select: {
        partId: true,
        quantity: true,
        occurredAt: true,
      },
    }),
    db.partTransaction.findMany({
      where: {
        type: PartTransactionType.RECEIVE,
        occurredAt: { gte: vendorWindowStart },
        vendorId: { not: null },
      },
      select: {
        vendorId: true,
        quantity: true,
        occurredAt: true,
        vendor: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
  ]);

  const partIds = parts.map((p) => p.id);

  const latestIssueGroups = partIds.length
    ? await db.partTransaction.groupBy({
        by: ["partId"],
        where: {
          type: PartTransactionType.ISSUE,
          partId: { in: partIds },
        },
        _max: {
          occurredAt: true,
        },
      })
    : [];

  const latestIssueMap = new Map<string, Date>();
  for (const group of latestIssueGroups) {
    if (group._max.occurredAt) {
      latestIssueMap.set(group.partId, group._max.occurredAt);
    }
  }

  const issueMap = new Map<string, IssueAccumulator>();
  for (const tx of issueTransactions) {
    const existing = issueMap.get(tx.partId) ?? { quantity: 0, lastIssuedAt: null };
    existing.quantity += toNumber(tx.quantity);
    if (!existing.lastIssuedAt || tx.occurredAt > existing.lastIssuedAt) {
      existing.lastIssuedAt = tx.occurredAt;
    }
    issueMap.set(tx.partId, existing);
  }

  const totalActiveParts = parts.length;

  const totalOnHandValue = parts.reduce(
    (total, part) => total + toNumber(part.quantityOnHand) * toNumber(part.unitCost),
    0,
  );

  const totalReservedUnits = parts.reduce(
    (total, part) => total + toNumber(part.quantityReserved),
    0,
  );

  const totalIssuedWindow = Array.from(issueMap.values()).reduce(
    (total, entry) => total + entry.quantity,
    0,
  );

  const lowStockParts = parts
    .filter(
      (part) =>
        toNumber(part.reorderPoint) > 0 &&
        toNumber(part.quantityOnHand) <= toNumber(part.reorderPoint),
    )
    .sort((left, right) => {
      const leftGap = toNumber(left.quantityOnHand) - toNumber(left.reorderPoint);
      const rightGap = toNumber(right.quantityOnHand) - toNumber(right.reorderPoint);
      return leftGap - rightGap;
    });

  const belowReorderCount = lowStockParts.length;
  const stockoutCount = lowStockParts.filter(
    (part) => toNumber(part.quantityOnHand) <= 0,
  ).length;

  const turnRowsSource = parts
    .map((part) => {
      const issued = issueMap.get(part.id);
      return {
        part,
        issuedQuantity: issued?.quantity ?? 0,
        lastIssuedAt: issued?.lastIssuedAt ?? null,
      };
    })
    .filter((row) => row.issuedQuantity > 0)
    .sort((left, right) => right.issuedQuantity - left.issuedQuantity);

  const movingPartCount = turnRowsSource.length;

  const deadStockCandidates = parts
    .map((part) => {
      const lastIssuedAt = latestIssueMap.get(part.id) ?? null;
      const onHand = toNumber(part.quantityOnHand);
      const idleReferenceDate = lastIssuedAt ?? part.updatedAt;
      const idleDays = differenceInCalendarDays(now, idleReferenceDate);
      return {
        part,
        lastIssuedAt,
        onHand,
        idleDays,
      };
    })
    .filter(
      (row) =>
        row.onHand > 0 &&
        row.idleDays >= DEAD_STOCK_THRESHOLD_DAYS &&
        !issueMap.has(row.part.id),
    )
    .sort((left, right) => {
      const leftValue = left.onHand * toNumber(left.part.unitCost);
      const rightValue = right.onHand * toNumber(right.part.unitCost);
      if (rightValue !== leftValue) {
        return rightValue - leftValue;
      }
      return right.idleDays - left.idleDays;
    });

  const deadStockValue = deadStockCandidates.reduce(
    (total, row) => total + row.onHand * toNumber(row.part.unitCost),
    0,
  );

  const vendorMap = new Map<string, VendorAccumulator>();
  for (const tx of vendorReceives) {
    const vendor = tx.vendor;
    if (!vendor) continue;
    const existing = vendorMap.get(vendor.id) ?? {
      id: vendor.id,
      name: vendor.name,
      receiveCount: 0,
      quantityReceived: 0,
      lastReceivedAt: null,
    };
    existing.receiveCount += 1;
    existing.quantityReceived += toNumber(tx.quantity);
    if (!existing.lastReceivedAt || tx.occurredAt > existing.lastReceivedAt) {
      existing.lastReceivedAt = tx.occurredAt;
    }
    vendorMap.set(vendor.id, existing);
  }

  const vendorRowsSource = Array.from(vendorMap.values()).sort(
    (left, right) => right.receiveCount - left.receiveCount,
  );

  const activeVendorCount = vendorRowsSource.length;
  const totalReceiveEvents = vendorRowsSource.reduce(
    (total, entry) => total + entry.receiveCount,
    0,
  );

  const report: PartsInventoryReport = {
    title: "Parts and Inventory Report",
    description:
      "This view keeps the four load-bearing inventory questions in one place: which parts are under reorder right now, what is actually moving, where dead stock is tying up value, and which vendors have been replenishing recently.",
    windows: [
      {
        label: "Velocity window",
        detail: `Issue activity uses the last ${VELOCITY_WINDOW_DAYS} days of ISSUE transactions.`,
      },
      {
        label: "Dead stock threshold",
        detail: `A part counts as dead stock when on-hand is positive and there has been no ISSUE activity in the last ${DEAD_STOCK_THRESHOLD_DAYS} days.`,
      },
      {
        label: "Vendor window",
        detail: `Vendor responsiveness uses RECEIVE transactions in the last ${VENDOR_WINDOW_DAYS} days.`,
      },
    ],
    heroMetrics: [
      {
        label: "Active parts",
        value: formatCount(totalActiveParts),
        detail: "Active, non-deleted parts in the catalog.",
        href: "/parts",
      },
      {
        label: "On-hand value",
        value: formatCurrency(totalOnHandValue),
        detail: "Sum of quantityOnHand * unitCost for active parts.",
      },
      {
        label: "Reserved units",
        value: formatDecimal(totalReservedUnits),
        detail: "Units currently reserved against active work.",
      },
      {
        label: `Issued (${VELOCITY_WINDOW_DAYS}d)`,
        value: formatDecimal(totalIssuedWindow),
        detail: `Units issued from stock in the last ${VELOCITY_WINDOW_DAYS} days.`,
      },
    ],
    lowStockMetrics: [
      {
        label: "Below reorder point",
        value: formatCount(belowReorderCount),
        detail: "Active parts with on-hand <= reorder point.",
      },
      {
        label: "Currently stocked out",
        value: formatCount(stockoutCount),
        detail: "Parts that ship under reorder with zero on hand.",
      },
    ],
    lowStockRows: lowStockParts.slice(0, TOP_ROW_LIMIT).map((part) => ({
      label: `${part.sku} | ${part.name}`,
      value: `${formatDecimal(part.quantityOnHand)} on hand`,
      detail: buildLowStockDetail(part),
      href: `/parts/${part.id}`,
    })),
    turnMetrics: [
      {
        label: "Parts with movement",
        value: formatCount(movingPartCount),
        detail: `Active parts with at least one ISSUE in the last ${VELOCITY_WINDOW_DAYS} days.`,
      },
      {
        label: "Total units issued",
        value: formatDecimal(totalIssuedWindow),
        detail: `Sum of ISSUE quantities in the last ${VELOCITY_WINDOW_DAYS} days.`,
      },
    ],
    turnRows: turnRowsSource.slice(0, TOP_ROW_LIMIT).map((row) => ({
      label: `${row.part.sku} | ${row.part.name}`,
      value: `${formatDecimal(row.issuedQuantity)} issued`,
      detail: buildTurnDetail(row.part, row.issuedQuantity, row.lastIssuedAt),
      href: `/parts/${row.part.id}`,
    })),
    deadStockMetrics: [
      {
        label: "Dead stock candidates",
        value: formatCount(deadStockCandidates.length),
        detail: `On-hand > 0 with no issue in the last ${DEAD_STOCK_THRESHOLD_DAYS} days.`,
      },
      {
        label: "Tied-up value",
        value: formatCurrency(deadStockValue),
        detail: "Sum of on-hand * unitCost for dead stock candidates.",
      },
    ],
    deadStockRows: deadStockCandidates.slice(0, TOP_ROW_LIMIT).map((row) => ({
      label: `${row.part.sku} | ${row.part.name}`,
      value: formatCurrency(row.onHand * toNumber(row.part.unitCost)),
      detail: buildDeadStockDetail(row.onHand, row.idleDays, row.lastIssuedAt),
      href: `/parts/${row.part.id}`,
    })),
    vendorMetrics: [
      {
        label: `Active vendors (${VENDOR_WINDOW_DAYS}d)`,
        value: formatCount(activeVendorCount),
        detail: `Vendors with at least one RECEIVE in the last ${VENDOR_WINDOW_DAYS} days.`,
      },
      {
        label: "Receive events",
        value: formatCount(totalReceiveEvents),
        detail: "Total RECEIVE transactions in the vendor window.",
      },
    ],
    vendorRows: vendorRowsSource.slice(0, TOP_ROW_LIMIT).map((entry) => ({
      label: entry.name,
      value: `${formatCount(entry.receiveCount)} receives`,
      detail: buildVendorDetail(entry, now),
      href: `/vendors/${entry.id}`,
    })),
  };

  return report;
}

type DecimalLike = { toNumber(): number } | number | string | null | undefined;

function buildLowStockDetail(part: {
  reorderPoint: DecimalLike;
  quantityReserved: DecimalLike;
  unitCost: DecimalLike;
  vendor: { name: string } | null;
  category: { name: string } | null;
}) {
  const segments = [
    `Reorder at ${formatDecimal(part.reorderPoint)}`,
    `Reserved ${formatDecimal(part.quantityReserved)}`,
    `Unit cost ${formatCurrency(part.unitCost)}`,
  ];
  if (part.vendor) {
    segments.push(`Vendor ${part.vendor.name}`);
  }
  if (part.category) {
    segments.push(`Category ${part.category.name}`);
  }
  return segments.join(" | ");
}

function buildTurnDetail(
  part: { quantityOnHand: DecimalLike; unitCost: DecimalLike; vendor: { name: string } | null },
  issuedQuantity: number,
  lastIssuedAt: Date | null,
) {
  const onHand = toNumber(part.quantityOnHand);
  const coverage =
    issuedQuantity > 0 && onHand > 0
      ? ` | ${(onHand / (issuedQuantity / VELOCITY_WINDOW_DAYS)).toFixed(1)}d coverage at current pace`
      : "";
  const vendor = part.vendor ? ` | Vendor ${part.vendor.name}` : "";
  const last = lastIssuedAt
    ? ` | Last issued ${lastIssuedAt.toISOString().slice(0, 10)}`
    : "";
  return `On hand ${formatDecimal(part.quantityOnHand)}${coverage}${vendor}${last}`;
}

function buildDeadStockDetail(onHand: number, idleDays: number, lastIssuedAt: Date | null) {
  const last = lastIssuedAt
    ? `Last issued ${lastIssuedAt.toISOString().slice(0, 10)}`
    : "No ISSUE activity recorded";
  return `On hand ${formatDecimal(onHand)} | Idle ${formatCount(idleDays)}d | ${last}`;
}

function buildVendorDetail(vendor: VendorAccumulator, now: Date) {
  const segments = [`Units received ${formatDecimal(vendor.quantityReceived)}`];
  if (vendor.lastReceivedAt) {
    const sinceDays = differenceInCalendarDays(now, vendor.lastReceivedAt);
    segments.push(
      `Last receive ${vendor.lastReceivedAt.toISOString().slice(0, 10)} (${formatCount(sinceDays)}d ago)`,
    );
  } else {
    segments.push("No RECEIVE recorded in window");
  }
  return segments.join(" | ");
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDecimal(
  value: { toNumber(): number } | number | string | null | undefined,
): string {
  const numeric = toNumber(value);
  if (Number.isInteger(numeric)) {
    return formatCount(numeric);
  }
  return numeric.toFixed(1);
}
