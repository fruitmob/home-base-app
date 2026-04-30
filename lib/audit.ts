import { db } from "@/lib/db";
import { getClientIp } from "@/lib/auth";
import { Prisma } from "@/generated/prisma/client";

type AuditInput = {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  request?: Request;
};

type AuditJson = Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined;

export async function logAudit({
  actorUserId,
  action,
  entityType,
  entityId,
  before,
  after,
  request,
}: AuditInput) {
  try {
    await db.auditLog.create({
      data: {
        actorUserId,
        action,
        entityType,
        entityId,
        beforeJson: toAuditJson(before),
        afterJson: toAuditJson(after),
        ipAddress: request ? getClientIp(request) : null,
      },
    });
  } catch (error) {
    console.error("Audit logging failed", error);
  }
}

function toAuditJson(value: unknown): AuditJson {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return Prisma.JsonNull;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
