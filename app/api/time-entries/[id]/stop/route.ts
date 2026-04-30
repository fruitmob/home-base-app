import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { TimeEntryEventType } from "@/generated/prisma/client";

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
      return NextResponse.json({ error: "Unauthorized. You can only stop your own timer." }, { status: 403 });
    }

    if (!timeEntry.active && !timeEntry.pauseReason) {
      return NextResponse.json({ error: "Timer is not active or paused." }, { status: 400 });
    }
    
    if (timeEntry.endedAt) {
      return NextResponse.json({ error: "Timer is already stopped." }, { status: 400 });
    }

    const now = new Date();

    // If it was paused, we don't add time. If it was active, we add time.
    let addedMinutes = 0;
    if (timeEntry.active && timeEntry.startedAt) {
      const millisElapsed = now.getTime() - timeEntry.startedAt.getTime();
      addedMinutes = Math.max(0, Math.floor(millisElapsed / 60000));
    }
    
    const newTotal = timeEntry.durationMinutes + addedMinutes;

    const updated = await db.$transaction(async (tx) => {
      const entry = await tx.timeEntry.update({
        where: { id: timeEntry.id },
        data: {
          active: false,
          pauseReason: null,
          endedAt: now,
          durationMinutes: newTotal,
          // When officially stopping, we auto-populate billableMinutes for convenience
          // though techs can adjust it before submission if UI allows it.
          // Let's populate it so total shows up immediately.
          billableMinutes: newTotal,
        }
      });

      await tx.timeEntryEvent.create({
        data: {
          timeEntryId: entry.id,
          workOrderId: entry.workOrderId,
          userId: entry.userId,
          createdByUserId: user.id,
          eventType: TimeEntryEventType.STOP,
          occurredAt: now,
          minutesDelta: addedMinutes,
        }
      });

      return entry;
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("POST /api/time-entries/[id]/stop error:", error);
    
    if (error instanceof Error && error.name === "HttpError") {
      return NextResponse.json({ error: error.message }, { status: (error as unknown as { status: number }).status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
