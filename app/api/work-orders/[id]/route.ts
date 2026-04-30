import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import {
  apiErrorResponse,
  readJsonObject,
  requireWorkOrderWrite,
} from "@/lib/core/api";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseWorkOrderInput } from "@/lib/shop/validators";
import { findActiveWorkOrder } from "@/lib/shop/workOrders";

type RouteContext = {
  params: { id: string };
};

export async function GET(request: Request, { params }: RouteContext) {
  try {
    await requireAuth(request);
    const workOrder = await findActiveWorkOrder(params.id);

    return NextResponse.json({ workOrder });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const user = await requireWorkOrderWrite(request);
    const workOrder = await findActiveWorkOrder(params.id);
    const body = await readJsonObject(request);
    const patchBody = { ...body };
    delete patchBody.status;
    delete patchBody.startedAt;
    delete patchBody.completedAt;
    delete patchBody.closedAt;

    const input = parseWorkOrderInput({
      customerId: workOrder.customerId,
      vehicleId: workOrder.vehicleId,
      opportunityId: workOrder.opportunityId,
      quoteId: workOrder.quoteId,
      bayId: workOrder.bayId,
      serviceWriterUserId: workOrder.serviceWriterUserId,
      assignedTechUserId: workOrder.assignedTechUserId,
      status: workOrder.status,
      priority: workOrder.priority,
      title: workOrder.title,
      complaint: workOrder.complaint,
      internalNotes: workOrder.internalNotes,
      odometerIn: workOrder.odometerIn,
      odometerOut: workOrder.odometerOut,
      promisedAt: workOrder.promisedAt?.toISOString() ?? null,
      startedAt: workOrder.startedAt?.toISOString() ?? null,
      completedAt: workOrder.completedAt?.toISOString() ?? null,
      closedAt: workOrder.closedAt?.toISOString() ?? null,
      ...patchBody,
    });

    const updated = await db.workOrder.update({
      where: { id: workOrder.id },
      data: {
        customerId: input.customerId,
        vehicleId: input.vehicleId,
        opportunityId: input.opportunityId,
        quoteId: input.quoteId,
        bayId: input.bayId,
        serviceWriterUserId: input.serviceWriterUserId,
        assignedTechUserId: input.assignedTechUserId,
        priority: input.priority,
        title: input.title,
        complaint: input.complaint,
        internalNotes: input.internalNotes,
        odometerIn: input.odometerIn,
        odometerOut: input.odometerOut,
        promisedAt: input.promisedAt,
      },
    });

    await logAudit({
      actorUserId: user.id,
      action: "work_order.update",
      entityType: "WorkOrder",
      entityId: workOrder.id,
      before: workOrder,
      after: updated,
      request,
    });

    return NextResponse.json({ workOrder: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const user = await requireWorkOrderWrite(request);
    const workOrder = await findActiveWorkOrder(params.id);
    const updated = await db.workOrder.update({
      where: { id: workOrder.id },
      data: { deletedAt: new Date() },
    });

    await logAudit({
      actorUserId: user.id,
      action: "work_order.delete",
      entityType: "WorkOrder",
      entityId: workOrder.id,
      before: workOrder,
      after: updated,
      request,
    });

    return NextResponse.json({ workOrder: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
