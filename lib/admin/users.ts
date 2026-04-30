import { Prisma, Role } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { CurrentUser, hashPassword, HttpError } from "@/lib/auth";
import { db } from "@/lib/db";

export type AdminUserStatusFilter = "all" | "active" | "inactive";

export type AdminUserSummary = {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  disabledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type ListAdminUsersOptions = {
  query?: string;
  role?: Role | null;
  status?: AdminUserStatusFilter;
  take?: number;
};

type CreateAdminUserInput = {
  email: string;
  password: string;
  role: Role;
};

type UpdateAdminUserInput = {
  role?: Role;
  isActive?: boolean;
};

export async function listAdminUsers(options: ListAdminUsersOptions = {}) {
  const whereAnd: Prisma.UserWhereInput[] = [];
  const status = options.status ?? "all";
  const query = options.query?.trim();

  if (status === "active") {
    whereAnd.push({ deletedAt: null });
  } else if (status === "inactive") {
    whereAnd.push({ deletedAt: { not: null } });
  }

  if (options.role) {
    whereAnd.push({ role: options.role });
  }

  if (query) {
    whereAnd.push({
      email: {
        contains: query,
        mode: Prisma.QueryMode.insensitive,
      },
    });
  }

  const where = whereAnd.length ? { AND: whereAnd } : undefined;
  const take = clampTake(options.take ?? 200);

  const [users, activeCount, inactiveCount] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: [{ deletedAt: "asc" }, { email: "asc" }],
      take,
    }),
    db.user.count({ where: { deletedAt: null } }),
    db.user.count({ where: { deletedAt: { not: null } } }),
  ]);

  return {
    users: users.map(toAdminUserSummary),
    counts: {
      active: activeCount,
      inactive: inactiveCount,
      total: activeCount + inactiveCount,
    },
  };
}

export async function createAdminUser(
  input: CreateAdminUserInput,
  actor: CurrentUser,
  request: Request,
) {
  assertCanAssignRole(actor, input.role);

  const email = normalizeEmail(input.email);
  const password = input.password;

  if (!isValidEmail(email)) {
    throw new HttpError(400, "Enter a valid email address.");
  }

  if (password.length < 10) {
    throw new HttpError(400, "Password must be at least 10 characters long.");
  }

  const user = await db.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      role: input.role,
    },
  });

  const summary = summarizeUserForAudit(user);
  await logAudit({
    actorUserId: actor.id,
    action: "admin.user.create",
    entityType: "User",
    entityId: user.id,
    after: summary,
    request,
  });

  return toAdminUserSummary(user);
}

export async function updateAdminUser(
  userId: string,
  input: UpdateAdminUserInput,
  actor: CurrentUser,
  request: Request,
) {
  const target = await db.user.findUnique({
    where: { id: userId },
  });

  if (!target) {
    throw new HttpError(404, "User not found.");
  }

  const currentIsActive = target.deletedAt === null;
  const nextRole = input.role ?? target.role;
  const nextIsActive = input.isActive ?? currentIsActive;

  await assertCanManageUser(actor, target, nextRole, nextIsActive);

  const data: Prisma.UserUpdateInput = {};

  if (input.role !== undefined && input.role !== target.role) {
    data.role = input.role;
  }

  if (input.isActive !== undefined && input.isActive !== currentIsActive) {
    data.deletedAt = input.isActive ? null : new Date();
  }

  if (Object.keys(data).length === 0) {
    return toAdminUserSummary(target);
  }

  const updated = await db.user.update({
    where: { id: userId },
    data,
  });

  await logAudit({
    actorUserId: actor.id,
    action: pickAdminUserUpdateAction(target, updated),
    entityType: "User",
    entityId: updated.id,
    before: summarizeUserForAudit(target),
    after: summarizeUserForAudit(updated),
    request,
  });

  return toAdminUserSummary(updated);
}

function toAdminUserSummary(user: {
  id: string;
  email: string;
  role: Role;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): AdminUserSummary {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    isActive: user.deletedAt === null,
    disabledAt: user.deletedAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function summarizeUserForAudit(user: {
  email: string;
  role: Role;
  deletedAt: Date | null;
}) {
  return {
    email: user.email,
    role: user.role,
    isActive: user.deletedAt === null,
  };
}

function pickAdminUserUpdateAction(
  before: {
    role: Role;
    deletedAt: Date | null;
  },
  after: {
    role: Role;
    deletedAt: Date | null;
  },
) {
  const roleChanged = before.role !== after.role;
  const activeChanged = (before.deletedAt === null) !== (after.deletedAt === null);

  if (roleChanged && activeChanged) {
    return "admin.user.update";
  }

  if (roleChanged) {
    return "admin.user.role_change";
  }

  if (before.deletedAt === null && after.deletedAt !== null) {
    return "admin.user.disable";
  }

  if (before.deletedAt !== null && after.deletedAt === null) {
    return "admin.user.restore";
  }

  return "admin.user.update";
}

async function assertCanManageUser(
  actor: CurrentUser,
  target: {
    id: string;
    role: Role;
    deletedAt: Date | null;
  },
  nextRole: Role,
  nextIsActive: boolean,
) {
  const actorIsOwner = actor.role === Role.OWNER;
  const targetIsOwner = target.role === Role.OWNER;

  if (!actorIsOwner && targetIsOwner) {
    throw new HttpError(403, "Only an owner can manage owner accounts.");
  }

  assertCanAssignRole(actor, nextRole);

  if (actor.id === target.id && nextRole !== target.role) {
    throw new HttpError(400, "Change your own role from another owner account.");
  }

  if (actor.id === target.id && !nextIsActive) {
    throw new HttpError(400, "You cannot disable your own account.");
  }

  if (target.role === Role.OWNER && (!nextIsActive || nextRole !== Role.OWNER)) {
    const remainingOwners = await db.user.count({
      where: {
        id: { not: target.id },
        role: Role.OWNER,
        deletedAt: null,
      },
    });

    if (remainingOwners === 0) {
      throw new HttpError(400, "Home Base must keep at least one active owner account.");
    }
  }
}

function assertCanAssignRole(actor: CurrentUser, role: Role) {
  if (actor.role !== Role.OWNER && role === Role.OWNER) {
    throw new HttpError(403, "Only an owner can assign the owner role.");
  }
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function clampTake(value: number) {
  if (!Number.isFinite(value)) {
    return 200;
  }

  return Math.max(1, Math.min(500, Math.floor(value)));
}
