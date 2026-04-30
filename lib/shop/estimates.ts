import { Prisma } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { notFound } from "@/lib/core/api";
import { db } from "@/lib/db";
import { withEstimateNumberRetry } from "@/lib/shop/numbering";
import { parseEstimateLineInput, type NormalizedEstimateLineInput } from "@/lib/shop/validators";

export const estimateDetailInclude = {
  customer: { select: { id: true, displayName: true } },
  vehicle: {
    select: {
      id: true,
      year: true,
      make: true,
      model: true,
      unitNumber: true,
    },
  },
  createdByUser: { select: { id: true, email: true } },
  lineItems: {
    where: { deletedAt: null },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
  },
} as const satisfies Prisma.EstimateInclude;

export type EstimateDetail = Prisma.EstimateGetPayload<{
  include: typeof estimateDetailInclude;
}>;

export async function findActiveEstimate(id: string) {
  const estimate = await db.estimate.findFirst({
    where: { id, deletedAt: null },
    include: estimateDetailInclude,
  });

  if (!estimate) {
    notFound("Estimate not found.");
  }

  return estimate;
}

export async function createDraftEstimate({
  userId,
  request,
  customerId,
  vehicleId,
  opportunityId,
  quoteId,
  title,
  notes,
  validUntil,
  lineItems = [],
}: {
  userId: string;
  request?: Request;
  customerId: string;
  vehicleId?: string | null;
  opportunityId?: string | null;
  quoteId?: string | null;
  title: string;
  notes?: string | null;
  validUntil?: Date | null;
  lineItems?: NormalizedEstimateLineInput[];
}) {
  const estimate = await withEstimateNumberRetry(async (estimateNumber) => {
    return db.$transaction(async (tx) => {
      const created = await tx.estimate.create({
        data: {
          estimateNumber,
          customerId,
          vehicleId: vehicleId ?? null,
          opportunityId: opportunityId ?? null,
          quoteId: quoteId ?? null,
          title,
          notes: notes ?? null,
          validUntil: validUntil ?? null,
          createdByUserId: userId,
        },
      });

      if (lineItems.length > 0) {
        for (const lineItem of lineItems) {
          await tx.estimateLineItem.create({
            data: {
              estimateId: created.id,
              ...lineItem,
            },
          });
        }

        const totals = calculateDocumentTotals(lineItems);
        await tx.estimate.update({
          where: { id: created.id },
          data: totals,
        });
      }

      return tx.estimate.findUniqueOrThrow({
        where: { id: created.id },
        include: estimateDetailInclude,
      });
    });
  });

  await logAudit({
    actorUserId: userId,
    action: "estimate.create",
    entityType: "Estimate",
    entityId: estimate.id,
    after: estimate,
    request,
  });

  return estimate;
}

export function normalizeEstimateLineItems(lineItems: unknown[]) {
  return lineItems.map((lineItem) => parseEstimateLineInput(lineItem));
}

function calculateDocumentTotals(lineItems: Array<Pick<NormalizedEstimateLineInput, "lineTotal" | "taxable">>) {
  const subtotal = lineItems.reduce((sum, item) => sum + Number(item.lineTotal), 0);
  const taxTotal = lineItems
    .filter((item) => item.taxable)
    .reduce((sum, item) => sum + Number(item.lineTotal) * 0.08, 0);

  return {
    subtotal,
    taxTotal,
    total: subtotal + taxTotal,
  };
}
