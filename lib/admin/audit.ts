import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

type ListAdminAuditEntriesOptions = {
  query?: string;
  actorUserId?: string;
  entityType?: string;
  action?: string;
  from?: string;
  to?: string;
  take?: number;
};

export async function listAdminAuditEntries(options: ListAdminAuditEntriesOptions = {}) {
  const whereAnd: Prisma.AuditLogWhereInput[] = [];
  const query = options.query?.trim();

  if (query) {
    whereAnd.push({
      OR: [
        {
          action: {
            contains: query,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          entityType: {
            contains: query,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          entityId: {
            contains: query,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          actorUser: {
            is: {
              email: {
                contains: query,
                mode: Prisma.QueryMode.insensitive,
              },
            },
          },
        },
      ],
    });
  }

  if (options.actorUserId) {
    whereAnd.push({ actorUserId: options.actorUserId });
  }

  if (options.entityType) {
    whereAnd.push({ entityType: options.entityType });
  }

  if (options.action) {
    whereAnd.push({ action: options.action });
  }

  const from = parseAuditDate(options.from);
  const to = parseAuditDate(options.to);

  if (from) {
    whereAnd.push({ createdAt: { gte: from } });
  }

  if (to) {
    whereAnd.push({ createdAt: { lte: to } });
  }

  return db.auditLog.findMany({
    where: whereAnd.length ? { AND: whereAnd } : undefined,
    include: {
      actorUser: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: clampTake(options.take ?? 100),
  });
}

export async function listAdminAuditActors() {
  return db.user.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      deletedAt: true,
    },
    orderBy: [{ email: "asc" }],
    take: 500,
  });
}

export async function listAdminAuditEntityTypes() {
  const rows = await db.auditLog.findMany({
    select: { entityType: true },
    distinct: ["entityType"],
    orderBy: { entityType: "asc" },
    take: 500,
  });

  return rows.map((row) => row.entityType);
}

export async function listAdminAuditActions() {
  const rows = await db.auditLog.findMany({
    select: { action: true },
    distinct: ["action"],
    orderBy: { action: "asc" },
    take: 500,
  });

  return rows.map((row) => row.action);
}

export function parseAuditDate(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function clampTake(value: number) {
  if (!Number.isFinite(value)) {
    return 100;
  }

  return Math.max(1, Math.min(500, Math.floor(value)));
}
