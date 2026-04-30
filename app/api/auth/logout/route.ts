import { NextResponse } from "next/server";
import {
  destroySession,
  getCookieValue,
  getExpiredSessionCookieOptions,
  isHttpError,
} from "@/lib/auth";
import {
  getExpiredCsrfCookieOptions,
  verifyCsrf,
} from "@/lib/csrf";
import { CSRF_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/authConstants";

export async function POST(request: Request) {
  try {
    verifyCsrf(request);
    await destroySession(getCookieValue(request, SESSION_COOKIE_NAME));

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE_NAME, "", getExpiredSessionCookieOptions());
    response.cookies.set(CSRF_COOKIE_NAME, "", getExpiredCsrfCookieOptions());

    return response;
  } catch (error) {
    if (isHttpError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
