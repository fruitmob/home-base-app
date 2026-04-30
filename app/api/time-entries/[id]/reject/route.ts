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
      return NextResponse.json({ error: "Unauthorized. You cannot reject time entries." }, { status: 403 });
    }

    let input: Record<string, unknown> = {};
    if (request.body) {
      try {
        input = await request.json();
      } catch { /* ignore */ }
    }
    if (!input || typeof input.rejectionReason !== "string" || !input.rejectionReason.trim()) {
      return NextResponse.json({ error: "A rejection reason is required." }, { status: 400 });
    }

    const timeEntry = await db.timeEntry.findUnique({
      where: { id: params.id, deletedAt: null },
    });

    if (!timeEntry) {
      return NextResponse.json({ error: "Time entry not found" }, { status: 404 });
    }

    if (!canTransitionTimeEntryStatus(timeEntry.status, TimeEntryStatus.REJECTED)) {
      return NextResponse.json({ error: "Invalid status transition" }, { status: 400 });
    }

    const now = new Date();

    const updated = await db.$transaction(async (tx) => {
      const entry = await tx.timeEntry.update({
        where: { id: timeEntry.id },
        data: {
          status: TimeEntryStatus.REJECTED,
          rejectedAt: now,
          rejectionReason: String(input.rejectionReason).trim(),
        }
      });

      await tx.timeEntryEvent.create({
        data: {
          timeEntryId: entry.id,
          workOrderId: entry.workOrderId,
          userId: entry.userId,
          createdByUserId: user.id,
          eventType: TimeEntryEventType.REJECT,
          occurredAt: now,
          note: String(input.rejectionReason).trim(),
        }
      });

      return entry;
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("POST /api/time-entries/[id]/reject error:", error);
    
    if (error instanceof Error && error.name === "HttpError") {
      return NextResponse.json({ error: error.message }, { status: (error as unknown as { status: number }).status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
