import { Prisma } from "@/generated/prisma/client";
import { notFound } from "@/lib/core/api";
import { db } from "@/lib/db";
import { sum } from "@/lib/core/money";

export const workOrderInclude = {
  customer: { select: { id: true, displayName: true } },
  vehicle: {
    select: {
      id: true,
      year: true,
      make: true,
      model: true,
      unitNumber: true,
      normalizedVin: true,
      currentMileage: true,
    },
  },
  opportunity: { select: { id: true, name: true } },
  quote: { select: { id: true, quoteNumber: true, status: true } },
  bay: { select: { id: true, name: true } },
  serviceWriter: { select: { id: true, email: true } },
  assignedTech: { select: { id: true, email: true } },
  lineItems: {
    where: { deletedAt: null },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    include: {
      product: { select: { id: true, sku: true, name: true } },
      part: { select: { id: true, sku: true, name: true } },
    },
  },
  statusHistory: {
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      changedByUser: { select: { id: true, email: true } },
    },
  },
  arrivalInspections: {
    where: { deletedAt: null },
    select: { id: true, type: true, status: true },
    orderBy: { createdAt: "desc" },
  },
  warrantyClaims: {
    where: { deletedAt: null },
    select: { id: true, claimNumber: true, status: true },
    orderBy: { createdAt: "desc" },
  },
  videos: {
    where: { deletedAt: null },
    select: {
      id: true,
      title: true,
      status: true,
      thumbnailUrl: true,
      durationSeconds: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 12,
  },
} as const satisfies Prisma.WorkOrderInclude;

export type WorkOrderDetail = Prisma.WorkOrderGetPayload<{
  include: typeof workOrderInclude;
}>;

export async function findActiveWorkOrder(id: string): Promise<WorkOrderDetail> {
  const workOrder = await db.workOrder.findFirst({
    where: { id, deletedAt: null },
    include: workOrderInclude,
  });

  if (!workOrder) {
    notFound("Work order not found.");
  }

  return workOrder;
}

export function workOrderSubtotal(
  lineItems: Array<{ lineTotal: unknown; deletedAt?: Date | string | null }>,
): number {
  return sum(lineItems.filter((line) => !line.deletedAt).map((line) => line.lineTotal as number | string));
}
