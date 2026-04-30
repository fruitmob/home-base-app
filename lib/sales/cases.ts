import { Prisma } from "@/generated/prisma/client";
import { notFound } from "@/lib/core/api";
import { db } from "@/lib/db";

export const caseDetailInclude = {
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
      unitNumber: true,
    },
  },
  openedByUser: {
    select: {
      id: true,
      email: true,
    },
  },
  assignedUser: {
    select: {
      id: true,
      email: true,
    },
  },
} satisfies Prisma.CaseInclude;

export async function findActiveCase(id: string) {
  const supportCase = await db.case.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    include: caseDetailInclude,
  });

  if (!supportCase) {
    notFound("Case was not found.");
  }

  return supportCase;
}
