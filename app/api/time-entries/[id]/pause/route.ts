import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { normalizePauseReason, canPauseTimer } from "@/lib/shop/time";
import { TimeEntryEventType } from "@/generated/prisma/client";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);
    let input: Record<string, unknown> = {};
    if (request.body) {
      try {
        input = await request.json();
      } catch { /* ignore */ }
    }
    const inputReason = input?.pauseReason;

    const timeEntry = await db.timeEntry.findUnique({
      where: { id: params.id, deletedAt: null },
    });

    if (!timeEntry) {
      return NextResponse.json({ error: "Time entry not found" }, { status: 404 });
    }

    if (timeEntry.userId !== user.id) {
      return NextResponse.json({ error: "Unauthorized. You can only pause your own timer." }, { status: 403 });
    }

    if (!canPauseTimer(timeEntry)) {
      return NextResponse.json({ error: "Timer is not active or already paused." }, { status: 400 });
    }

    const pauseReason = normalizePauseReason(typeof inputReason === "string" ? inputReason : null) || "OTHER";
    
    // We will do this in a transaction.
    // 1. Calculate the minutes since startedAt.
    // 2. Add to durationMinutes.
    // 3. Set endedAt = now (Wait, if we pause, we shouldn't necessarily set endedAt if we want to resume. 
    //    Actually, our check constraint says active=false OR (startedAt is not null AND endedAt is null).
    //    So if we pause, we can leave it active=false, startedAt=..., endedAt=... ? No, the schema says: 
    //    "active" = false OR ("startedAt" IS NOT NULL AND "endedAt" IS NULL AND "deletedAt" IS NULL)
    //    If active=false, endedAt CAN be null or not null.
    //    So what's best? When we pause, we can just set endedAt = null. No, that violates logic if they stop it.
    //    If we pause, we calculate duration from startedAt to now, add it to total, and then when they resume,
    //    we set startedAt to the new resume time! That way duration is cumulative.
    
    // So PAUSE: active=false, pauseReason=..., endedAt=null. Add duration to durationMinutes.
    const now = new Date();
    const millisElapsed = now.getTime() - (timeEntry.startedAt?.getTime() || now.getTime());
    const addedMinutes = Math.max(0, Math.floor(millisElapsed / 60000));
    const newTotal = timeEntry.durationMinutes + addedMinutes;

    const updated = await db.$transaction(async (tx) => {
      const entry = await tx.timeEntry.update({
        where: { id: timeEntry.id },
        data: {
          active: false,
          pauseReason,
          durationMinutes: newTotal,
          // We leave endedAt null. Next time they resume, we update startedAt = now.
        }
      });

      await tx.timeEntryEvent.create({
        data: {
          timeEntryId: entry.id,
          workOrderId: entry.workOrderId,
          userId: entry.userId,
          createdByUserId: user.id,
          eventType: TimeEntryEventType.PAUSE,
          occurredAt: now,
          pauseReason,
          minutesDelta: addedMinutes,
        }
      });

      return entry;
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("POST /api/time-entries/[id]/pause error:", error);
    if (error instanceof Error && error.name === "HttpError") {
      return NextResponse.json({ error: error.message }, { status: (error as unknown as { status: number }).status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
