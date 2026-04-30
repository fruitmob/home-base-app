import { Prisma, Role } from "@/generated/prisma/client";
import { notFound } from "@/lib/core/api";
import { db } from "@/lib/db";
import { CurrentUser } from "@/lib/auth";

export const leadDetailInclude: Prisma.LeadInclude = {
  customer: {
    select: {
      id: true,
      displayName: true,
    },
  },
  ownerUser: {
    select: {
      id: true,
      email: true,
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

export async function findActiveLead(id: string) {
  const lead = await db.lead.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    include: leadDetailInclude,
  });

  if (!lead) {
    notFound("Lead was not found.");
  }

  return lead;
}

export function canMutateLead(user: CurrentUser, leadOwnerUserId: string | null): boolean {
  if (leadOwnerUserId === null) {
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

  if (user.role === Role.SALES_REP && user.id === leadOwnerUserId) {
    return true;
  }

  return false;
}
