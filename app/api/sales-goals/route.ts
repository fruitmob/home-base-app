import { NextResponse } from "next/server";
import { Prisma, Role } from "@/generated/prisma/client";
import { requireAuth } from "@/lib/auth";
import {
  apiErrorResponse,
  conflict,
  readJsonObject,
  requireSalesGoalWrite,
} from "@/lib/core/api";
import { parseSalesGoalInput } from "@/lib/sales/validators";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { attainment } from "@/lib/sales/goals";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period")?.trim();
    const userId = searchParams.get("userId")?.trim();

    const whereAnd: Prisma.SalesGoalWhereInput[] = [{ deletedAt: null }];

    if (period) {
      whereAnd.push({ period });
    }

    if (user.role === Role.SALES_REP) {
      whereAnd.push({ userId: user.id });
    } else if (userId) {
      whereAnd.push({ userId });
    }

    const goals = await db.salesGoal.findMany({
      where: { AND: whereAnd },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: [{ period: "desc" }, { createdAt: "desc" }],
      take: 200,
    });

    const enrichedGoals = await Promise.all(
      goals.map(async (goal) => {
        const attainmentAmount = await attainment(goal.userId, goal.period);
        const targetAmount = Number(goal.targetAmount);

        return {
          ...goal,
          attainmentAmount,
          attainmentPercent: targetAmount > 0 ? Math.round((attainmentAmount / targetAmount) * 100) : 0,
        };
      }),
    );

    return NextResponse.json({ goals: enrichedGoals });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireSalesGoalWrite(request);
    const input = parseSalesGoalInput(await readJsonObject(request));

    const existing = await db.salesGoal.findFirst({
      where: {
        userId: input.userId,
        period: input.period,
        deletedAt: null,
      },
    });

    if (existing) {
      conflict("A sales goal already exists for that user and period.");
    }

    const goal = await db.salesGoal.create({
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
      action: "sales_goal.create",
      entityType: "SalesGoal",
      entityId: goal.id,
      after: goal,
      request,
    });

    return NextResponse.json({ goal }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
