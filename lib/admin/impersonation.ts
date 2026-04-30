import { logAudit } from "@/lib/audit";
import { CurrentUser, HttpError } from "@/lib/auth";
import { db } from "@/lib/db";
import { Role } from "@/generated/prisma/client";

export type ActiveImpersonation = {
  id: string;
  actorUserId: string;
  actorEmail: string;
  targetUserId: string;
  targetEmail: string;
  targetRole: Role;
  reason: string;
  startedAt: Date;
};

export async function startImpersonation(
  targetUserId: string,
  reason: string,
  actor: CurrentUser,
  request: Request,
): Promise<ActiveImpersonation> {
  if (actor.role !== Role.OWNER) {
    throw new HttpError(403, "Only an owner can impersonate another user.");
  }

  if (actor.id === targetUserId) {
    throw new HttpError(400, "You cannot impersonate yourself.");
  }

  if (!reason?.trim()) {
    throw new HttpError(400, "A reason is required to start impersonation.");
  }

  const target = await db.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, email: true, role: true, deletedAt: true },
  });

  if (!target) {
    throw new HttpError(404, "Target user not found.");
  }

  if (target.deletedAt !== null) {
    throw new HttpError(400, "Cannot impersonate a disabled account.");
  }

  if (target.role === Role.OWNER) {
    throw new HttpError(400, "Cannot impersonate another owner account.");
  }

  // End any existing active impersonation by this actor first
  await db.impersonation.updateMany({
    where: { actorUserId: actor.id, endedAt: null },
    data: { endedAt: new Date() },
  });

  const imp = await db.impersonation.create({
    data: {
      actorUserId: actor.id,
      targetUserId: target.id,
      reason: reason.trim(),
      ipAddress: getIp(request),
    },
  });

  await logAudit({
    actorUserId: actor.id,
    action: "admin.impersonation.start",
    entityType: "Impersonation",
    entityId: imp.id,
    after: { targetUserId: target.id, targetEmail: target.email, reason: reason.trim() },
    request,
  });

  return {
    id: imp.id,
    actorUserId: actor.id,
    actorEmail: actor.email,
    targetUserId: target.id,
    targetEmail: target.email,
    targetRole: target.role,
    reason: imp.reason,
    startedAt: imp.startedAt,
  };
}

export async function stopImpersonation(
  impersonationId: string,
  actor: CurrentUser,
  request: Request,
): Promise<void> {
  const imp = await db.impersonation.findFirst({
    where: { id: impersonationId, actorUserId: actor.id, endedAt: null },
  });

  if (!imp) return; // Already ended or doesn't belong to this actor — no-op

  await db.impersonation.update({
    where: { id: imp.id },
    data: { endedAt: new Date() },
  });

  await logAudit({
    actorUserId: actor.id,
    action: "admin.impersonation.stop",
    entityType: "Impersonation",
    entityId: imp.id,
    before: { targetUserId: imp.targetUserId, reason: imp.reason },
    request,
  });
}

export async function getActiveImpersonation(
  impersonationId: string | null | undefined,
  actorUserId: string,
): Promise<ActiveImpersonation | null> {
  if (!impersonationId) return null;

  const imp = await db.impersonation.findFirst({
    where: { id: impersonationId, actorUserId, endedAt: null },
    include: {
      actorUser: { select: { email: true } },
      targetUser: { select: { id: true, email: true, role: true, deletedAt: true } },
    },
  });

  if (!imp || imp.targetUser.deletedAt !== null) return null;

  return {
    id: imp.id,
    actorUserId: imp.actorUserId,
    actorEmail: imp.actorUser.email,
    targetUserId: imp.targetUser.id,
    targetEmail: imp.targetUser.email,
    targetRole: imp.targetUser.role,
    reason: imp.reason,
    startedAt: imp.startedAt,
  };
}

function getIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return request.headers.get("x-real-ip") ?? null;
}
