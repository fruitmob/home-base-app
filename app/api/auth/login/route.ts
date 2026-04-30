import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  createSession,
  getSessionCookieOptions,
  publicUser,
  verifyPassword,
} from "@/lib/auth";
import { CSRF_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/authConstants";
import { getCsrfCookieOptions, issueCsrfToken } from "@/lib/csrf";
import { logAudit } from "@/lib/audit";

type LoginBody = {
  email?: unknown;
  password?: unknown;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as LoginBody | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { email },
  });

  if (!user || user.deletedAt || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  }

  const session = await createSession(user.id, request);
  const csrfToken = issueCsrfToken();
  const response = NextResponse.json({ user: publicUser(user) });

  await logAudit({
    actorUserId: user.id,
    action: "auth.login",
    entityType: "User",
    entityId: user.id,
    after: { email: user.email, role: user.role },
    request,
  });

  response.cookies.set(SESSION_COOKIE_NAME, session.id, getSessionCookieOptions(session.expiresAt));
  response.cookies.set(CSRF_COOKIE_NAME, csrfToken, getCsrfCookieOptions(session.expiresAt));

  return response;
}
