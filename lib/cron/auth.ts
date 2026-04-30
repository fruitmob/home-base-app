import { timingSafeEqual } from "node:crypto";
import { HttpError } from "@/lib/auth";

/**
 * Guards cron endpoints with a shared secret. Vercel Cron can be configured to
 * send `Authorization: Bearer ${CRON_SECRET}` on every scheduled invocation; we
 * match on that exact header + env var pair.
 */
export function requireCronSecret(request: Request): void {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    throw new HttpError(503, "CRON_SECRET is not configured on this deployment.");
  }

  const header = request.headers.get("authorization");
  if (!header) {
    throw new HttpError(401, "Cron authorization header is missing.");
  }

  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) {
    throw new HttpError(401, "Cron authorization header is malformed.");
  }

  const provided = match[1].trim();
  if (!safeEqual(provided, secret)) {
    throw new HttpError(401, "Cron secret did not match.");
  }
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
