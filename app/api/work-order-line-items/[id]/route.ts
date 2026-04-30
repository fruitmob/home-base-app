import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import {
  apiErrorResponse,
  readJsonObject,
  requireWorkOrderWrite,
} from "@/lib/core/api";
import { db } from "@/lib/db";
import { parseWorkOrderLineInput } from "@/lib/shop/validators";
import { findActiveWorkOrder } from "@/lib/shop/workOrders";

type RouteContext = {
  params: { id: string };
};

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const user = await requireWorkOrderWrite(request);
    const lineItem = await db.workOrderLineItem.findFirst({
      where: { id: params.id, deletedAt: null },
    });

    if (!lineItem) {
      return NextResponse.json({ error: "Work order line item not found." }, { status: 404 });
    }

    await findActiveWorkOrder(lineItem.workOrderId);
    const input = parseWorkOrderLineInput({
      productId: lineItem.productId,
      partId: lineItem.partId,
      lineType: lineItem.lineType,
      status: lineItem.status,
      description: lineItem.description,
      quantity: Number(lineItem.quantity),
      unitPrice: Number(lineItem.unitPrice),
      unitCost: lineItem.unitCost == null ? null : Number(lineItem.unitCost),
      taxable: lineItem.taxable,
      displayOrder: lineItem.displayOrder,
      completedAt: lineItem.completedAt?.toISOString() ?? null,
      ...(await readJsonObject(request)),
    });

    const updated = await db.workOrderLineItem.update({
      where: { id: lineItem.id },
      data: input,
      include: {
        product: { select: { id: true, sku: true, name: true } },
        part: { select: { id: true, sku: true, name: true } },
      },
    });

    await logAudit({
      actorUserId: user.id,
      action: "work_order.line_item.update",
      entityType: "WorkOrder",
      entityId: lineItem.workOrderId,
      before: lineItem,
      after: updated,
      request,
    });

    return NextResponse.json({ lineItem: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const user = await requireWorkOrderWrite(request);
    const lineItem = await db.workOrderLineItem.findFirst({
      where: { id: params.id, deletedAt: null },
    });

    if (!lineItem) {
      return NextResponse.json({ error: "Work order line item not found." }, { status: 404 });
    }

    await findActiveWorkOrder(lineItem.workOrderId);
    const updated = await db.workOrderLineItem.update({
      where: { id: lineItem.id },
      data: { deletedAt: new Date() },
    });

    await logAudit({
      actorUserId: user.id,
      action: "work_order.line_item.delete",
      entityType: "WorkOrder",
      entityId: lineItem.workOrderId,
      before: lineItem,
      after: updated,
      request,
    });

    return NextResponse.json({ lineItem: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
