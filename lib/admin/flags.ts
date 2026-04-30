import { logAudit } from "@/lib/audit";
import { CurrentUser, HttpError } from "@/lib/auth";
import { db } from "@/lib/db";
import { Role } from "@/generated/prisma/client";

type CreateFlagInput = {
  key: string;
  label: string;
  description?: string;
  enabled?: boolean;
};

type UpdateFlagInput = {
  label?: string;
  description?: string;
  enabled?: boolean;
};

function requireOwner(actor: CurrentUser) {
  if (actor.role !== Role.OWNER) {
    throw new HttpError(403, "Only an owner can manage feature flags.");
  }
}

export async function listFeatureFlags() {
  return db.featureFlag.findMany({
    orderBy: [{ enabled: "desc" }, { key: "asc" }],
  });
}

export async function createFeatureFlag(
  input: CreateFlagInput,
  actor: CurrentUser,
  request: Request,
) {
  requireOwner(actor);

  const key = input.key.trim().toLowerCase().replace(/\s+/g, "_");

  if (!key || !/^[a-z0-9_.]+$/.test(key)) {
    throw new HttpError(
      400,
      "Flag key must contain only lowercase letters, numbers, dots, and underscores.",
    );
  }

  if (!input.label?.trim()) {
    throw new HttpError(400, "Flag label is required.");
  }

  const existing = await db.featureFlag.findUnique({ where: { key } });
  if (existing) {
    throw new HttpError(409, `A feature flag with key "${key}" already exists.`);
  }

  const flag = await db.featureFlag.create({
    data: {
      key,
      label: input.label.trim(),
      description: input.description?.trim() || null,
      enabled: input.enabled ?? false,
    },
  });

  await logAudit({
    actorUserId: actor.id,
    action: "admin.flag.create",
    entityType: "FeatureFlag",
    entityId: flag.id,
    after: { key: flag.key, label: flag.label, enabled: flag.enabled },
    request,
  });

  return flag;
}

export async function updateFeatureFlag(
  flagId: string,
  input: UpdateFlagInput,
  actor: CurrentUser,
  request: Request,
) {
  requireOwner(actor);

  const flag = await db.featureFlag.findUnique({ where: { id: flagId } });
  if (!flag) throw new HttpError(404, "Feature flag not found.");

  const updated = await db.featureFlag.update({
    where: { id: flagId },
    data: {
      ...(input.label !== undefined ? { label: input.label.trim() } : {}),
      ...(input.description !== undefined
        ? { description: input.description?.trim() || null }
        : {}),
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
    },
  });

  await logAudit({
    actorUserId: actor.id,
    action: input.enabled !== undefined ? (input.enabled ? "admin.flag.enable" : "admin.flag.disable") : "admin.flag.update",
    entityType: "FeatureFlag",
    entityId: flag.id,
    before: { key: flag.key, label: flag.label, enabled: flag.enabled },
    after: { key: updated.key, label: updated.label, enabled: updated.enabled },
    request,
  });

  return updated;
}

export async function deleteFeatureFlag(
  flagId: string,
  actor: CurrentUser,
  request: Request,
) {
  requireOwner(actor);

  const flag = await db.featureFlag.findUnique({ where: { id: flagId } });
  if (!flag) throw new HttpError(404, "Feature flag not found.");

  await db.featureFlag.delete({ where: { id: flagId } });

  await logAudit({
    actorUserId: actor.id,
    action: "admin.flag.delete",
    entityType: "FeatureFlag",
    entityId: flag.id,
    before: { key: flag.key, label: flag.label, enabled: flag.enabled },
    request,
  });
}
