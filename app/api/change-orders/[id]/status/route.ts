import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";
import { ChangeOrderStatus } from "@/generated/prisma/client";
import { requireAuth } from "@/lib/auth";
import { apiErrorResponse, readJsonObject } from "@/lib/core/api";
import { db } from "@/lib/db";
import { readRequiredString, parseEnum } from "@/lib/core/validators";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth(request);
    const input = await readJsonObject(request);
    
    // We expect a literal string representing the new status.
    const newStatusString = readRequiredString(input as Record<string, unknown>, "status");
    const status = parseEnum(newStatusString, ChangeOrderStatus, "status", ChangeOrderStatus.DRAFT);

    return await db.$transaction(async (tx) => {
      const changeOrder = await tx.changeOrder.findUnique({
        where: { id: params.id, deletedAt: null },
        include: { lineItems: { where: { deletedAt: null } } },
      });

      if (!changeOrder) {
        return NextResponse.json({ error: "Change order not found" }, { status: 404 });
      }

      const updates: any /* eslint-disable-line @typescript-eslint/no-explicit-any */ = { status };

      if (status === "SENT" && !changeOrder.sentAt) {
        updates.sentAt = new Date();
      } else if (status === "APPROVED" && !changeOrder.approvedAt) {
        updates.approvedAt = new Date();
        
        // --- Injection Logic ---
        // Copy all change order lines into the parent work order
        for (const line of changeOrder.lineItems) {
          await tx.workOrderLineItem.create({
            data: {
              workOrderId: changeOrder.workOrderId,
              productId: line.productId,
              partId: line.partId,
              lineType: line.lineType,
              description: line.description,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              unitCost: line.unitCost,
              lineTotal: line.lineTotal,
              taxable: line.taxable,
              displayOrder: line.displayOrder, // Optionally bump this so it shows up at the end
              status: "OPEN",
            },
          });
        }
      } else if (status === "DECLINED" && !changeOrder.declinedAt) {
        updates.declinedAt = new Date();
      }

      const updated = await tx.changeOrder.update({
        where: { id: params.id },
        data: updates,
      });

      return NextResponse.json({ changeOrder: updated });
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
