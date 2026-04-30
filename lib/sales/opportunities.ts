import { Prisma, Role } from "@/generated/prisma/client";
import { notFound } from "@/lib/core/api";
import { db } from "@/lib/db";
import { CurrentUser } from "@/lib/auth";

export const opportunityDetailInclude: Prisma.OpportunityInclude = {
  customer: {
    select: {
      id: true,
      displayName: true,
    },
  },
  vehicle: {
    select: {
      id: true,
      year: true,
      make: true,
      model: true,
    },
  },
  ownerUser: {
    select: {
      id: true,
      email: true,
    },
  },
  convertedFromLead: {
    select: {
      id: true,
      displayName: true,
    },
  },
  activities: {
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      ownerUser: { select: { email: true } },
    },
  },
};

export async function findActiveOpportunity(id: string) {
  const opportunity = await db.opportunity.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    include: opportunityDetailInclude,
  });

  if (!opportunity) {
    notFound("Opportunity was not found.");
  }

  return opportunity;
}

export function canMutateOpportunity(user: CurrentUser, opportunityOwnerUserId: string | null): boolean {
  if (opportunityOwnerUserId === null) {
    return true;
  }

  if (
    user.role === Role.OWNER ||
    user.role === Role.ADMIN ||
    user.role === Role.MANAGER ||
    user.role === Role.SALES_MANAGER
  ) {
    return true;
  }

  if (user.role === Role.SALES_REP && user.id === opportunityOwnerUserId) {
    return true;
  }

  return false;
}
