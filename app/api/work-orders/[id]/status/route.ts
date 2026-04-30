import { NextResponse } from "next/server";
import { WorkOrderStatus } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import {
  apiErrorResponse,
  notFound,
  readJsonObject,
  requireWorkOrderWrite,
} from "@/lib/core/api";
import { db } from "@/lib/db";
import { validateWorkOrderStatusTransition, StatusTransitionError } from "@/lib/shop/status";
import { emitWebhook } from "@/lib/webhooks/dispatch";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireWorkOrderWrite(request);
    const body = await readJsonObject(request);
    
    const newStatus = body.status as WorkOrderStatus;
    if (!Object.values(WorkOrderStatus).includes(newStatus)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }

    const workOrder = await db.workOrder.findUnique({
      where: { id: params.id, deletedAt: null },
    });

    if (!workOrder) {
      notFound("Work order not found.");
    }

    if (workOrder.status === newStatus) {
      return NextResponse.json({ workOrder });
    }

    try {
      await validateWorkOrderStatusTransition(workOrder.id, workOrder.status as WorkOrderStatus, newStatus, { db });
    } catch (e) {
      if (e instanceof StatusTransitionError) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }

    const updated = await db.$transaction(async (tx) => {
      const updatedWo = await tx.workOrder.update({
        where: { id: params.id },
        data: { status: newStatus },
      });

      await tx.workOrderStatusHistory.create({
        data: {
          workOrderId: params.id,
          fromStatus: workOrder.status,
          toStatus: newStatus,
          changedByUserId: user.id,
        },
      });

      return updatedWo;
    });

    await logAudit({
      actorUserId: user.id,
      action: "work_order.update_status",
      entityType: "WorkOrder",
      entityId: updated.id,
      before: workOrder,
      after: updated,
      request,
    });

    await emitWebhook({
      eventType: "work_order.status_changed",
      payload: {
        workOrderId: updated.id,
        workOrderNumber: updated.workOrderNumber,
        fromStatus: workOrder.status,
        toStatus: updated.status,
        customerId: updated.customerId,
        vehicleId: updated.vehicleId,
        changedByUserId: user.id,
        changedAt: new Date().toISOString(),
      },
    }).catch((error) => {
      console.error("[webhook] failed to emit work_order.status_changed", error);
    });

    return NextResponse.json({ workOrder: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
