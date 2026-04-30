import { randomBytes, timingSafeEqual } from "node:crypto";
import { getCookieValue, HttpError } from "@/lib/auth";
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "@/lib/authConstants";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function issueCsrfToken() {
  return randomBytes(32).toString("base64url");
}

export function getCsrfCookieOptions(expiresAt?: Date) {
  return {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    ...(expiresAt ? { expires: expiresAt } : {}),
  };
}

export function getExpiredCsrfCookieOptions() {
  return {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}

export function verifyCsrf(request: Request) {
  if (!MUTATING_METHODS.has(request.method.toUpperCase())) {
    return;
  }

  const headerToken = request.headers.get(CSRF_HEADER_NAME);
  const cookieToken = getCookieValue(request, CSRF_COOKIE_NAME);

  if (!headerToken || !cookieToken || !tokensMatch(headerToken, cookieToken)) {
    throw new HttpError(403, "Invalid CSRF token.");
  }
}

function tokensMatch(a: string, b: string) {
  const first = Buffer.from(a);
  const second = Buffer.from(b);

  return first.length === second.length && timingSafeEqual(first, second);
}
