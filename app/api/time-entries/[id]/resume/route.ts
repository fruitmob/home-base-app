import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { canResumeTimer } from "@/lib/shop/time";
import { TimeEntryEventType, Prisma } from "@/generated/prisma/client";

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
      return NextResponse.json({ error: "Unauthorized. You can only resume your own timer." }, { status: 403 });
    }

    // `canResumeTimer` requires that active=false but it was somehow paused.
    // Actually we just check `canResumeTimer`
    if (!canResumeTimer(timeEntry)) {
      return NextResponse.json({ error: "Timer is not paused." }, { status: 400 });
    }

    const now = new Date();

    const updated = await db.$transaction(async (tx) => {
      const entry = await tx.timeEntry.update({
        where: { id: timeEntry.id },
        data: {
          active: true,
          pauseReason: null,
          startedAt: now, // Reset startedAt to now to compute elapsed time properly
        }
      });

      await tx.timeEntryEvent.create({
        data: {
          timeEntryId: entry.id,
          workOrderId: entry.workOrderId,
          userId: entry.userId,
          createdByUserId: user.id,
          eventType: TimeEntryEventType.RESUME,
          occurredAt: now,
        }
      });

      return entry;
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("POST /api/time-entries/[id]/resume error:", error);
    
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: "There is already an active timer for this user." }, { status: 409 });
    }

    if (error instanceof Error && error.name === "HttpError") {
      return NextResponse.json({ error: error.message }, { status: (error as unknown as { status: number }).status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
