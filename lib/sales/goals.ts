import { OpportunityStage, Role, type SalesGoal } from "@/generated/prisma/client";
import { CurrentUser } from "@/lib/auth";
import { notFound } from "@/lib/core/api";
import { ValidationError } from "@/lib/core/validators";
import { db } from "@/lib/db";

export function periodBounds(period: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(period);

  if (!match) {
    throw new ValidationError(["period must be formatted as YYYY-MM."]);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (month < 1 || month > 12) {
    throw new ValidationError(["period must be formatted as YYYY-MM."]);
  }

  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  return { start, end };
}

export async function attainment(userId: string, period: string) {
  const { start, end } = periodBounds(period);

  const result = await db.opportunity.aggregate({
    where: {
      ownerUserId: userId,
      stage: OpportunityStage.WON,
      closedAt: {
        gte: start,
        lt: end,
      },
      deletedAt: null,
    },
    _sum: {
      amount: true,
    },
  });

  return Number(result._sum.amount ?? 0);
}

export async function findActiveSalesGoal(id: string) {
  const goal = await db.salesGoal.findFirst({
    where: {
      id,
      deletedAt: null,
    },
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

  if (!goal) {
    notFound("Sales goal was not found.");
  }

  return goal;
}

export function canReadSalesGoal(user: CurrentUser, goal: Pick<SalesGoal, "userId">) {
  if (user.role === Role.SALES_REP) {
    return goal.userId === user.id;
  }

  return true;
}
