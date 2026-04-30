import { requireSalesWrite } from "@/lib/core/api";
import { NextResponse } from "next/server";
import { Prisma, ActivityType, ActivityStatus } from "@/generated/prisma/client";
import { requireAuth } from "@/lib/auth";
import {
  apiErrorResponse,
  hasField,
  readJsonObject,
  readRequiredStringField,
  requireCaseWrite,
} from "@/lib/core/api";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { ACTIVITY_PARENTS, getActivityParentKey } from "@/lib/sales/activities";

export async function GET(request: Request) {
  try {
    await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const where: Prisma.ActivityWhereInput = { deletedAt: null };

    let hasParent = false;
    for (const key of ACTIVITY_PARENTS) {
      const val = searchParams.get(key);
      if (val) {
        where[key] = val;
        hasParent = true;
      }
    }

    if (!hasParent) {
      return NextResponse.json(
        { error: "Must specify at least one parent (e.g. ?leadId=...)" },
        { status: 400 },
      );
    }

    const activities = await db.activity.findMany({
      where,
      orderBy: [
        { status: "asc" }, // OPEN before COMPLETED/CANCELED
        { dueAt: "asc" },
        { createdAt: "desc" },
      ],
      include: {
        ownerUser: {
          select: { id: true, email: true },
        },
      },
    });

    return NextResponse.json(activities);
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJsonObject(request);
    const parentKey = getActivityParentKey(body);

    if (!parentKey) {
      return NextResponse.json(
        { error: "Exactly one parent ID (leadId, opportunityId, customerId, vehicleId, caseId) must be specified." },
        { status: 400 },
      );
    }

    const user = ["leadId", "opportunityId"].includes(parentKey)
      ? await requireSalesWrite(request)
      : await requireCaseWrite(request);

    const typeStr = readRequiredStringField(body, "type");
    if (!Object.values(ActivityType).includes(typeStr as ActivityType)) {
      return NextResponse.json({ error: "Invalid activity type." }, { status: 400 });
    }
    const type = typeStr as ActivityType;

    const subject = readRequiredStringField(body, "subject");
    const notes = hasField(body, "body") && typeof body.body === "string" ? body.body.trim() : null;
    let dueAt: Date | null = null;

    if (hasField(body, "dueAt") && typeof body.dueAt === "string" && body.dueAt.trim() !== "") {
      dueAt = new Date(body.dueAt);
    }

    // Default status logic based on suggestion: Note is auto-completed.
    const status = type === ActivityType.NOTE ? ActivityStatus.COMPLETED : ActivityStatus.OPEN;
    const completedAt = status === ActivityStatus.COMPLETED ? new Date() : null;

    let ownerUserId = user.id;
    if (hasField(body, "ownerUserId") && typeof body.ownerUserId === "string" && body.ownerUserId.trim() !== "") {
      ownerUserId = body.ownerUserId.trim();
    }

    const data: Prisma.ActivityUncheckedCreateInput = {
      type,
      subject,
      body: notes,
      status,
      dueAt,
      completedAt,
      ownerUserId,
      [parentKey]: body[parentKey] as string,
    };

    const activity = await db.activity.create({ data });

    await logAudit({
      action: "activity.create",
      entityType: "Activity",
      entityId: activity.id,
      actorUserId: user.id,
      after: activity,
    });

    return NextResponse.json(activity, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
