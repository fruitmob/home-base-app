import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { canApproveTimeEntries } from "@/lib/core/permissions";
import { canTransitionTimeEntryStatus } from "@/lib/shop/time";
import { TimeEntryStatus, TimeEntryEventType } from "@/generated/prisma/client";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);

    if (!canApproveTimeEntries(user.role)) {
      return NextResponse.json({ error: "Unauthorized. You cannot approve time entries." }, { status: 403 });
    }

    const timeEntry = await db.timeEntry.findUnique({
      where: { id: params.id, deletedAt: null },
    });

    if (!timeEntry) {
      return NextResponse.json({ error: "Time entry not found" }, { status: 404 });
    }

    if (!canTransitionTimeEntryStatus(timeEntry.status, TimeEntryStatus.APPROVED)) {
      return NextResponse.json({ error: "Invalid status transition" }, { status: 400 });
    }

    const now = new Date();

    const updated = await db.$transaction(async (tx) => {
      const entry = await tx.timeEntry.update({
        where: { id: timeEntry.id },
        data: {
          status: TimeEntryStatus.APPROVED,
          approvedAt: now,
          approvedByUserId: user.id,
        }
      });

      await tx.timeEntryEvent.create({
        data: {
          timeEntryId: entry.id,
          workOrderId: entry.workOrderId,
          userId: entry.userId,
          createdByUserId: user.id,
          eventType: TimeEntryEventType.APPROVE,
          occurredAt: now,
        }
      });

      return entry;
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("POST /api/time-entries/[id]/approve error:", error);
    
    if (error instanceof Error && error.name === "HttpError") {
      return NextResponse.json({ error: error.message }, { status: (error as unknown as { status: number }).status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
