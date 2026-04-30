import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import {
  canWriteTimeEntries,
  canApproveTimeEntries,
} from "@/lib/core/permissions";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);

    const timeEntry = await db.timeEntry.findUnique({
      where: { id: params.id, deletedAt: null },
      include: {
        events: {
          orderBy: { occurredAt: "asc" },
        },
        user: { select: { id: true, email: true } },
      },
    });

    if (!timeEntry) {
      return NextResponse.json({ error: "Time entry not found" }, { status: 404 });
    }

    if (!canWriteTimeEntries(user.role) && timeEntry.userId !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    return NextResponse.json(timeEntry);
  } catch (error) {
    console.error("GET /api/time-entries/[id] error:", error);
    if (error instanceof Error && error.name === "HttpError") {
      return NextResponse.json({ error: error.message }, { status: (error as unknown as { status: number }).status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
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

    if (!input || typeof input !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const timeEntry = await db.timeEntry.findUnique({
      where: { id: params.id, deletedAt: null },
    });

    if (!timeEntry) {
      return NextResponse.json({ error: "Time entry not found" }, { status: 404 });
    }

    // Role check:
    const isOwner = timeEntry.userId === user.id;
    const isManager = canApproveTimeEntries(user.role);

    if (!isOwner && !isManager) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // If it's already approved/locked, block unless manager? 
    // Actually, if it's locked, no one should edit. If approved, maybe managers can.
    // simpler: If NOT DRAFT or REJECTED, only managers can edit.
    if (timeEntry.status !== "DRAFT" && timeEntry.status !== "REJECTED" && !isManager) {
      return NextResponse.json({ error: "Cannot edit submitted/approved time entry" }, { status: 400 });
    }

    if (timeEntry.status === "LOCKED") {
      return NextResponse.json({ error: "Cannot edit locked time entry" }, { status: 400 });
    }

    const note = typeof input.note === "string" ? input.note : timeEntry.note;
    const billableMinutes = typeof input.billableMinutes === "number" ? input.billableMinutes : timeEntry.billableMinutes;
    const goodwillMinutes = typeof input.goodwillMinutes === "number" ? input.goodwillMinutes : timeEntry.goodwillMinutes;

    // We do NOT allow changing durationMinutes or active/status directly through this endpoint.
    
    // Only managers can change billable/goodwill independently. 
    // Usually, durationMinutes is copied to billableMinutes when stopping,
    // but a manager can adjust it. Let's just track edits if we want, or rely on events (adjust).
    // For now we just mutate.
    const updated = await db.timeEntry.update({
      where: { id: timeEntry.id },
      data: {
        note,
        billableMinutes: isManager ? billableMinutes : timeEntry.billableMinutes,
        goodwillMinutes: isManager ? goodwillMinutes : timeEntry.goodwillMinutes,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/time-entries/[id] error:", error);
    if (error instanceof Error && error.name === "HttpError") {
      return NextResponse.json({ error: error.message }, { status: (error as unknown as { status: number }).status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
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

    const isOwner = timeEntry.userId === user.id;
    const isManager = canApproveTimeEntries(user.role);

    if (!isOwner && !isManager) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Only DRAFT or REJECTED can be soft deleted easily
    if (timeEntry.status !== "DRAFT" && timeEntry.status !== "REJECTED" && !isManager) {
      return NextResponse.json({ error: "Cannot delete submitted time entry" }, { status: 400 });
    }
    
    if (timeEntry.status === "LOCKED") {
        return NextResponse.json({ error: "Cannot delete locked time entry" }, { status: 400 });
    }

    // Since we track 'active', we must set active = false when deleting to free up the slot.
    // Also mark endedAt if active.
    await db.timeEntry.update({
      where: { id: timeEntry.id },
      data: { 
        deletedAt: new Date(), 
        active: false,
        endedAt: timeEntry.active ? new Date() : timeEntry.endedAt 
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/time-entries/[id] error:", error);
    if (error instanceof Error && error.name === "HttpError") {
      return NextResponse.json({ error: error.message }, { status: (error as unknown as { status: number }).status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
