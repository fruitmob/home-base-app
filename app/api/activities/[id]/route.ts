import { requireSalesWrite } from "@/lib/core/api";
import { NextResponse } from "next/server";
import { Prisma, ActivityStatus, type Activity } from "@/generated/prisma/client";
import { requireAuth } from "@/lib/auth";
import {
  apiErrorResponse,
  hasField,
  readJsonObject,
  requireCaseWrite,
} from "@/lib/core/api";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import {
  getActivityParentKey,
  canMutateActivity,
  findActiveActivity,
} from "@/lib/sales/activities";

async function requireWriteForActivity(request: Request, activity: Activity) {
  // Extract record as simple dict to find parent
  const parentKey = getActivityParentKey(activity as unknown as Record<string, unknown>);
  if (parentKey && ["leadId", "opportunityId"].includes(parentKey)) {
    return requireSalesWrite(request);
  }
  return requireCaseWrite(request);
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    await requireAuth(request);
    const activity = await findActiveActivity(params.id);
    return NextResponse.json(activity);
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const activity = await findActiveActivity(params.id);
    const user = await requireWriteForActivity(request, activity);

    if (!canMutateActivity(user, activity.ownerUserId)) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to edit this activity." },
        { status: 403 },
      );
    }

    const body = await readJsonObject(request);
    const data: Prisma.ActivityUncheckedUpdateInput = {};

    if (hasField(body, "status") && typeof body.status === "string") {
      if (!Object.values(ActivityStatus).includes(body.status as ActivityStatus)) {
        return NextResponse.json({ error: "Invalid status." }, { status: 400 });
      }
      data.status = body.status as ActivityStatus;

      // Handle automatic completedAt transitions
      if (data.status === ActivityStatus.COMPLETED && activity.status !== ActivityStatus.COMPLETED) {
        data.completedAt = new Date();
      } else if (data.status !== ActivityStatus.COMPLETED) {
        data.completedAt = null;
      }
    }

    if (hasField(body, "subject") && typeof body.subject === "string" && body.subject.trim() !== "") {
      data.subject = body.subject.trim();
    }

    if (hasField(body, "body")) {
      data.body = typeof body.body === "string" && body.body.trim() !== "" ? body.body.trim() : null;
    }

    if (hasField(body, "dueAt")) {
      data.dueAt =
        body.dueAt === null || body.dueAt === "" ? null : new Date(body.dueAt as string);
    }

    if (hasField(body, "ownerUserId")) {
      data.ownerUserId =
        typeof body.ownerUserId === "string" && body.ownerUserId.trim() !== ""
          ? body.ownerUserId.trim()
          : null;
    }

    const updated = await db.activity.update({
      where: { id: activity.id },
      data,
    });

    await logAudit({
      action: "activity.update",
      entityType: "Activity",
      entityId: activity.id,
      actorUserId: user.id,
      before: activity,
      after: updated,
    });

    return NextResponse.json(updated);
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const activity = await findActiveActivity(params.id);
    const user = await requireWriteForActivity(request, activity);

    if (!canMutateActivity(user, activity.ownerUserId)) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to delete this activity." },
        { status: 403 },
      );
    }

    await db.activity.update({
      where: { id: activity.id },
      data: { deletedAt: new Date() },
    });

    await logAudit({
      action: "activity.delete",
      entityType: "Activity",
      entityId: activity.id,
      actorUserId: user.id,
      before: activity,
      after: { deleted: true },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
