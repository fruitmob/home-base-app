import { NextResponse } from "next/server";
import { Prisma, WorkOrderPriority, WorkOrderStatus } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import {
  apiErrorResponse,
  readJsonObject,
  requireWorkOrderWrite,
} from "@/lib/core/api";
import { db } from "@/lib/db";
import { withWorkOrderNumberRetry } from "@/lib/shop/numbering";
import { parseWorkOrderInput } from "@/lib/shop/validators";

export async function GET(request: Request) {
  try {
    await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim();
    const status = searchParams.get("status")?.trim().toUpperCase();
    const priority = searchParams.get("priority")?.trim().toUpperCase();
    const customerId = searchParams.get("customerId")?.trim();
    const vehicleId = searchParams.get("vehicleId")?.trim();
    const bayId = searchParams.get("bayId")?.trim();
    const serviceWriterUserId = searchParams.get("serviceWriterUserId")?.trim();
    const assignedTechUserId = searchParams.get("assignedTechUserId")?.trim();

    const where: Prisma.WorkOrderWhereInput = { deletedAt: null };

    if (status) {
      if (!Object.values(WorkOrderStatus).includes(status as WorkOrderStatus)) {
        return NextResponse.json({ error: "Invalid work order status." }, { status: 400 });
      }

      where.status = status as WorkOrderStatus;
    }

    if (priority) {
      if (!Object.values(WorkOrderPriority).includes(priority as WorkOrderPriority)) {
        return NextResponse.json({ error: "Invalid work order priority." }, { status: 400 });
      }

      where.priority = priority as WorkOrderPriority;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (vehicleId) {
      where.vehicleId = vehicleId;
    }

    if (bayId) {
      where.bayId = bayId === "unassigned" ? null : bayId;
    }

    if (serviceWriterUserId) {
      where.serviceWriterUserId = serviceWriterUserId === "unassigned" ? null : serviceWriterUserId;
    }

    if (assignedTechUserId) {
      where.assignedTechUserId = assignedTechUserId === "unassigned" ? null : assignedTechUserId;
    }

    if (query) {
      where.OR = [
        { workOrderNumber: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { title: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { complaint: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { customer: { displayName: { contains: query, mode: Prisma.QueryMode.insensitive } } },
        { vehicle: { unitNumber: { contains: query, mode: Prisma.QueryMode.insensitive } } },
        { vehicle: { normalizedVin: { contains: query.toUpperCase(), mode: Prisma.QueryMode.insensitive } } },
      ];
    }

    const workOrders = await db.workOrder.findMany({
      where,
      orderBy: [
        { status: "asc" },
        { promisedAt: "asc" },
        { createdAt: "desc" },
      ],
      take: 250,
      include: {
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
        bay: { select: { id: true, name: true } },
        serviceWriter: { select: { id: true, email: true } },
        assignedTech: { select: { id: true, email: true } },
        _count: { select: { lineItems: true } },
      },
    });

    return NextResponse.json({ workOrders });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireWorkOrderWrite(request);
    const input = parseWorkOrderInput(await readJsonObject(request));

    if (input.status !== WorkOrderStatus.OPEN) {
      return NextResponse.json(
        { error: "New work orders must start as OPEN. Use the status route for lifecycle changes." },
        { status: 400 },
      );
    }

    const workOrder = await withWorkOrderNumberRetry(async (workOrderNumber) => {
      return db.workOrder.create({
        data: {
          workOrderNumber,
          customerId: input.customerId,
          vehicleId: input.vehicleId,
          opportunityId: input.opportunityId,
          quoteId: input.quoteId,
          bayId: input.bayId,
          serviceWriterUserId: input.serviceWriterUserId ?? user.id,
          assignedTechUserId: input.assignedTechUserId,
          status: WorkOrderStatus.OPEN,
          priority: input.priority,
          title: input.title,
          complaint: input.complaint,
          internalNotes: input.internalNotes,
          odometerIn: input.odometerIn,
          odometerOut: input.odometerOut,
          promisedAt: input.promisedAt,
          statusHistory: {
            create: {
              fromStatus: null,
              toStatus: WorkOrderStatus.OPEN,
              changedByUserId: user.id,
              reason: "Work order created",
            },
          },
        },
      });
    });

    await logAudit({
      actorUserId: user.id,
      action: "work_order.create",
      entityType: "WorkOrder",
      entityId: workOrder.id,
      after: workOrder,
      request,
    });

    return NextResponse.json({ workOrder }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
