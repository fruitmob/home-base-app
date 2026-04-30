import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { canTransitionTimeEntryStatus } from "@/lib/shop/time";
import { TimeEntryStatus, TimeEntryEventType } from "@/generated/prisma/client";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);

    const timeEntry = await db.timeEntry.findUnique({
      where: { id: params.id, deletedAt: null },
    });

    if (!timeEntry) {
      return NextResponse.json({ error: "Time entry not found" }, { status: 404 });
    }

    if (timeEntry.userId !== user.id) {
      return NextResponse.json({ error: "Unauthorized. You can only submit your own timer." }, { status: 403 });
    }

    if (timeEntry.active) {
      return NextResponse.json({ error: "Cannot submit an active timer." }, { status: 400 });
    }

    if (!canTransitionTimeEntryStatus(timeEntry.status, TimeEntryStatus.SUBMITTED)) {
      return NextResponse.json({ error: "Invalid status transition" }, { status: 400 });
    }

    const now = new Date();

    const updated = await db.$transaction(async (tx) => {
      const entry = await tx.timeEntry.update({
        where: { id: timeEntry.id },
        data: {
          status: TimeEntryStatus.SUBMITTED,
          submittedAt: now,
        }
      });

      await tx.timeEntryEvent.create({
        data: {
          timeEntryId: entry.id,
          workOrderId: entry.workOrderId,
          userId: entry.userId,
          createdByUserId: user.id,
          eventType: TimeEntryEventType.SUBMIT,
          occurredAt: now,
        }
      });

      return entry;
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("POST /api/time-entries/[id]/submit error:", error);
    
    if (error instanceof Error && error.name === "HttpError") {
      return NextResponse.json({ error: error.message }, { status: (error as unknown as { status: number }).status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
