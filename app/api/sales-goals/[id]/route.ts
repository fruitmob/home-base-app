import { NextResponse } from "next/server";
import { requireAuth, HttpError } from "@/lib/auth";
import {
  apiErrorResponse,
  conflict,
  readJsonObject,
  requireSalesGoalWrite,
} from "@/lib/core/api";
import { parseSalesGoalInput } from "@/lib/sales/validators";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import {
  attainment,
  canReadSalesGoal,
  findActiveSalesGoal,
} from "@/lib/sales/goals";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const user = await requireAuth(request);
    const goal = await findActiveSalesGoal(params.id);

    if (!canReadSalesGoal(user, goal)) {
      throw new HttpError(403, "You do not have access to this sales goal.");
    }

    const attainmentAmount = await attainment(goal.userId, goal.period);
    const targetAmount = Number(goal.targetAmount);

    return NextResponse.json({
      goal: {
        ...goal,
        attainmentAmount,
        attainmentPercent: targetAmount > 0 ? Math.round((attainmentAmount / targetAmount) * 100) : 0,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const user = await requireSalesGoalWrite(request);
    const before = await findActiveSalesGoal(params.id);
    const body = await readJsonObject(request);
    const input = parseSalesGoalInput({
      userId: before.userId,
      period: before.period,
      targetAmount: Number(before.targetAmount),
      notes: before.notes,
      ...body,
    });

    const duplicate = await db.salesGoal.findFirst({
      where: {
        id: { not: before.id },
        userId: input.userId,
        period: input.period,
        deletedAt: null,
      },
    });

    if (duplicate) {
      conflict("A sales goal already exists for that user and period.");
    }

    const goal = await db.salesGoal.update({
      where: { id: before.id },
      data: input,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    });

    await logAudit({
      actorUserId: user.id,
      action: "sales_goal.update",
      entityType: "SalesGoal",
      entityId: goal.id,
      before,
      after: goal,
      request,
    });

    return NextResponse.json({ goal });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const user = await requireSalesGoalWrite(request);
    const before = await findActiveSalesGoal(params.id);

    const goal = await db.salesGoal.update({
      where: { id: before.id },
      data: {
        deletedAt: new Date(),
      },
    });

    await logAudit({
      actorUserId: user.id,
      action: "sales_goal.delete",
      entityType: "SalesGoal",
      entityId: goal.id,
      before,
      after: goal,
      request,
    });

    return NextResponse.json({ goal });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
