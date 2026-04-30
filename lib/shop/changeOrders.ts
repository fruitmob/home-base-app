import { Prisma } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { notFound } from "@/lib/core/api";
import { db } from "@/lib/db";
import { withChangeOrderNumberRetry } from "@/lib/shop/numbering";
import { parseChangeOrderLineInput, type NormalizedEstimateLineInput } from "@/lib/shop/validators";

export const changeOrderDetailInclude = {
  workOrder: {
    select: {
      id: true,
      workOrderNumber: true,
      customerId: true,
      vehicleId: true,
    },
  },
  requestedByUser: { select: { id: true, email: true } },
  lineItems: {
    where: { deletedAt: null },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
  },
} as const satisfies Prisma.ChangeOrderInclude;

export type ChangeOrderDetail = Prisma.ChangeOrderGetPayload<{
  include: typeof changeOrderDetailInclude;
}>;

export async function findActiveChangeOrder(id: string) {
  const changeOrder = await db.changeOrder.findFirst({
    where: { id, deletedAt: null },
    include: changeOrderDetailInclude,
  });

  if (!changeOrder) {
    notFound("Change order not found.");
  }

  return changeOrder;
}

export async function createDraftChangeOrder({
  userId,
  request,
  workOrderId,
  title,
  reason,
  lineItems = [],
}: {
  userId: string;
  request?: Request;
  workOrderId: string;
  title: string;
  reason?: string | null;
  lineItems?: NormalizedEstimateLineInput[];
}) {
  const changeOrder = await withChangeOrderNumberRetry(async (changeOrderNumber) => {
    return db.$transaction(async (tx) => {
      const created = await tx.changeOrder.create({
        data: {
          changeOrderNumber,
          workOrderId,
          title,
          reason: reason ?? null,
          requestedByUserId: userId,
        },
      });

      if (lineItems.length > 0) {
        for (const lineItem of lineItems) {
          await tx.changeOrderLineItem.create({
            data: {
              changeOrderId: created.id,
              ...lineItem,
            },
          });
        }

        const totals = calculateDocumentTotals(lineItems);
        await tx.changeOrder.update({
          where: { id: created.id },
          data: totals,
        });
      }

      return tx.changeOrder.findUniqueOrThrow({
        where: { id: created.id },
        include: changeOrderDetailInclude,
      });
    });
  });

  await logAudit({
    actorUserId: userId,
    action: "change_order.create",
    entityType: "ChangeOrder",
    entityId: changeOrder.id,
    after: changeOrder,
    request,
  });

  return changeOrder;
}

export function normalizeChangeOrderLineItems(lineItems: unknown[]) {
  return lineItems.map((lineItem) => parseChangeOrderLineInput(lineItem));
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
