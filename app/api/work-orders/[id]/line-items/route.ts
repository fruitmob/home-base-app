import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import {
  apiErrorResponse,
  readJsonObject,
  requireWorkOrderWrite,
} from "@/lib/core/api";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseWorkOrderLineInput } from "@/lib/shop/validators";
import { findActiveWorkOrder } from "@/lib/shop/workOrders";

type RouteContext = {
  params: { id: string };
};

export async function GET(request: Request, { params }: RouteContext) {
  try {
    await requireAuth(request);
    await findActiveWorkOrder(params.id);

    const lineItems = await db.workOrderLineItem.findMany({
      where: { workOrderId: params.id, deletedAt: null },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      include: {
        product: { select: { id: true, sku: true, name: true } },
        part: { select: { id: true, sku: true, name: true } },
      },
    });

    return NextResponse.json({ lineItems });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const user = await requireWorkOrderWrite(request);
    const workOrder = await findActiveWorkOrder(params.id);
    const input = parseWorkOrderLineInput(await readJsonObject(request));
    const lineItem = await db.workOrderLineItem.create({
      data: {
        workOrderId: workOrder.id,
        ...input,
      },
      include: {
        product: { select: { id: true, sku: true, name: true } },
        part: { select: { id: true, sku: true, name: true } },
      },
    });

    await logAudit({
      actorUserId: user.id,
      action: "work_order.line_item.create",
      entityType: "WorkOrder",
      entityId: workOrder.id,
      after: lineItem,
      request,
    });

    return NextResponse.json({ lineItem }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
