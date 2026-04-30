import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { canApproveTimeEntries, canWriteTimeEntries } from "@/lib/core/permissions";
import { TimeEntryStatus, TimeEntryEventType, Prisma } from "@/generated/prisma/client";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);

    const qsUserId = searchParams.get("userId") || undefined;
    const workOrderId = searchParams.get("workOrderId") || undefined;
    const active = searchParams.has("active") ? searchParams.get("active") === "true" : undefined;
    const status = searchParams.get("status") as TimeEntryStatus | undefined;

    // Filter construction
    const where: Prisma.TimeEntryWhereInput = { deletedAt: null };
    
    if (canApproveTimeEntries(user.role)) {
      if (qsUserId) where.userId = qsUserId;
    } else {
      where.userId = user.id;
    }

    if (workOrderId) where.workOrderId = workOrderId;
    if (active !== undefined) where.active = active;
    if (status) where.status = status;

    const timeEntries = await db.timeEntry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        workOrder: {
          select: { workOrderNumber: true }
        },
        user: {
          select: { id: true, email: true }
        }
      },
      take: 100, // Reasonable limit
    });

    return NextResponse.json(timeEntries);
  } catch (error) {
    console.error("GET /api/time-entries error:", error);
    if (error instanceof Error && error.name === "HttpError") {
      return NextResponse.json({ error: error.message }, { status: (error as unknown as { status: number }).status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const requestUser = await requireAuth(request);
    let input: Record<string, unknown> = {};
    if (request.body) {
      try {
        input = await request.json();
      } catch { /* ignore */ }
    }

    if (!input || typeof input !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const workOrderId = typeof input.workOrderId === "string" ? input.workOrderId : null;
    const lineItemId = typeof input.lineItemId === "string" ? input.lineItemId : null;
    const targetUserId = typeof input.userId === "string" ? input.userId : requestUser.id;

    if (!workOrderId) {
      return NextResponse.json({ error: "workOrderId is required" }, { status: 400 });
    }

    // Role check: Only techs/managers can create.
    // Specifically, if creating for someone else, must be a manager. 
    // Here we just ensure they have TIME_ENTRY_WRITE_ROLES and if targetUserId != theirs, 
    // they must be elevated. But we will just allow anyone with WRITE_ROLES to track their own time,
    // and let's assume they can't set it for others unless they have elevated...
    // Actually, `canWriteTimeEntries` covers techs and managers. Techs shouldn't track time for others.
    if (!canWriteTimeEntries(requestUser.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    
    if (targetUserId !== requestUser.id && requestUser.role === "TECH") {
      return NextResponse.json({ error: "Techs can only track their own time" }, { status: 403 });
    }

    // Verify WO exists and is not closed
    const wo = await db.workOrder.findUnique({
      where: { id: workOrderId },
      select: { status: true, deletedAt: true }
    });

    if (!wo || wo.deletedAt) {
      return NextResponse.json({ error: "Work order not found" }, { status: 404 });
    }

    if (wo.status === "CLOSED") {
      return NextResponse.json({ error: "Cannot track time on a closed work order" }, { status: 400 });
    }

    // Try starting timer
    // We do this in a transaction because we need to insert TimeEntry and TimeEntryEvent
    const timeEntry = await db.$transaction(async (tx) => {
      const now = new Date();
      const entry = await tx.timeEntry.create({
        data: {
          workOrderId,
          lineItemId,
          userId: targetUserId,
          status: TimeEntryStatus.DRAFT,
          active: true,
          startedAt: now,
        }
      });

      await tx.timeEntryEvent.create({
        data: {
          timeEntryId: entry.id,
          workOrderId,
          userId: targetUserId,
          createdByUserId: requestUser.id,
          eventType: TimeEntryEventType.START,
          occurredAt: now,
        }
      });

      return entry;
    });

    return NextResponse.json(timeEntry);
  } catch (error) {
    console.error("POST /api/time-entries error:", error);
    
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: "There is already an active timer for this user." }, { status: 409 });
    }

    if (error instanceof Error && error.name === "HttpError") {
      return NextResponse.json({ error: error.message }, { status: (error as unknown as { status: number }).status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
