import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/core/api";
import { db } from "@/lib/db";
import { withWorkOrderNumberRetry } from "@/lib/shop/numbering";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);

    return await db.$transaction(async (tx) => {
      const estimate = await tx.estimate.findUnique({
        where: { id: params.id, deletedAt: null },
        include: { lineItems: { where: { deletedAt: null } } },
      });

      if (!estimate) {
        return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
      }

      if (estimate.status !== "APPROVED") {
        return NextResponse.json({ error: "Only approved estimates can be converted." }, { status: 400 });
      }

      if (estimate.convertedWorkOrderId) {
        return NextResponse.json({ error: "Estimate already converted." }, { status: 400 });
      }

      // Convert to work order
      const workOrder = await withWorkOrderNumberRetry(async (workOrderNumber) => {
        return tx.workOrder.create({
          data: {
            workOrderNumber,
            customerId: estimate.customerId,
            vehicleId: estimate.vehicleId,
            opportunityId: estimate.opportunityId,
            quoteId: estimate.quoteId,
            title: estimate.title,
            complaint: estimate.notes,
            status: "OPEN",
            priority: "NORMAL",
            serviceWriterUserId: user.id,
            lineItems: {
              create: estimate.lineItems.map((line) => ({
                productId: line.productId,
                partId: line.partId,
                lineType: line.lineType,
                description: line.description,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                unitCost: line.unitCost,
                lineTotal: line.lineTotal,
                taxable: line.taxable,
                displayOrder: line.displayOrder,
                status: "OPEN",
              })),
            },
          },
        });
      });

      // Update estimate to link back
      await tx.estimate.update({
        where: { id: params.id },
        data: { convertedWorkOrderId: workOrder.id },
      });

      return NextResponse.json({ workOrder }, { status: 201 });
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
