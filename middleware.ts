import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/authConstants";

const PUBLIC_FILE = /\.(.*)$/;
const PUBLIC_PATHS = new Set(["/login", "/favicon.ico"]);
// These API prefixes handle their own authentication at the route handler —
// /api/auth (login/logout/me), /api/public (API-key Bearer auth),
// /api/webhooks (HMAC signature verification), /api/cron (CRON_SECRET header),
// /portal (tokenized customer portal).
const PUBLIC_API_PREFIXES = [
  "/api/auth",
  "/api/public",
  "/api/webhooks",
  "/api/cron",
  "/api/portal",
];
const PUBLIC_API_PATHS = new Set(["/api/health"]);

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  if (hasSession) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);

  return NextResponse.redirect(loginUrl);
}

function isPublicPath(pathname: string) {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/public/") ||
    PUBLIC_FILE.test(pathname) ||
    PUBLIC_PATHS.has(pathname) ||
    PUBLIC_API_PATHS.has(pathname) ||
    PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
