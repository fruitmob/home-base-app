import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { SESSION_COOKIE_NAME } from "@/lib/authConstants";
import { Role, type User } from "@/generated/prisma/client";

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type CurrentUser = Pick<User, "id" | "email" | "role" | "createdAt" | "updatedAt">;

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function getCookieValue(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie");

  if (!cookieHeader) {
    return null;
  }

  for (const cookie of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = cookie.trim().split("=");

    if (rawName === name) {
      return decodeURIComponent(rawValue.join("="));
    }
  }

  return null;
}

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  return request.headers.get("x-real-ip") ?? request.headers.get("cf-connecting-ip");
}

export function getSessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}

export function getExpiredSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}

export async function createSession(userId: string, request: Request) {
  const id = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  await db.session.create({
    data: {
      id,
      userId,
      expiresAt,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
    },
  });

  return { id, expiresAt };
}

export async function destroySession(sessionId: string | null) {
  if (!sessionId) {
    return;
  }

  await db.session.updateMany({
    where: { id: sessionId },
    data: { expiresAt: new Date() },
  });
}

export async function getCurrentUser(request: Request): Promise<CurrentUser | null> {
  const sessionId = getCookieValue(request, SESSION_COOKIE_NAME);

  return getCurrentUserFromSessionId(sessionId);
}

export async function getCurrentUserFromSessionId(
  sessionId: string | null | undefined,
): Promise<CurrentUser | null> {
  if (!sessionId) {
    return null;
  }

  const session = await db.session.findFirst({
    where: {
      id: sessionId,
      expiresAt: { gt: new Date() },
      user: { deletedAt: null },
    },
    include: { user: true },
  });

  if (!session) {
    return null;
  }

  await db.session.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date() },
  });

  return publicUser(session.user);
}

export async function requireAuth(request: Request) {
  const user = await getCurrentUser(request);

  if (!user) {
    throw new HttpError(401, "Authentication required.");
  }

  return user;
}

export async function requireRole(request: Request, roles: readonly Role[]) {
  const user = await requireAuth(request);

  if (!roles.includes(user.role)) {
    throw new HttpError(403, "You do not have access to this resource.");
  }

  return user;
}

export function requireAdmin(request: Request) {
  return requireRole(request, [Role.OWNER, Role.ADMIN]);
}

export function publicUser(user: User): CurrentUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
