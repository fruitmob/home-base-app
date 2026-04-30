import { GaugeToolCallStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export async function listRecentGaugeToolCallsForAdmin(take = 100) {
  return db.gaugeToolCall.findMany({
    orderBy: [{ createdAt: "desc" }],
    take,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
      conversation: {
        select: {
          id: true,
          title: true,
          provider: true,
          model: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });
}

export async function listRecentGaugeWriteToolCallsForAdmin(take = 100) {
  return db.gaugeToolCall.findMany({
    where: {
      writeRequested: true,
    },
    orderBy: [{ createdAt: "desc" }],
    take,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
      conversation: {
        select: {
          id: true,
          title: true,
          provider: true,
          model: true,
        },
      },
    },
  });
}

export async function listPendingGaugeWriteToolCallsForAdmin(take = 100) {
  return db.gaugeToolCall.findMany({
    where: {
      writeRequested: true,
      status: GaugeToolCallStatus.BLOCKED,
    },
    orderBy: [{ createdAt: "desc" }],
    take,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
      conversation: {
        select: {
          id: true,
          title: true,
          provider: true,
          model: true,
        },
      },
    },
  });
}
