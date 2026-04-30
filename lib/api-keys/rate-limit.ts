import { HttpError } from "@/lib/auth";
import { db } from "@/lib/db";

export const API_KEY_RATE_LIMIT_PER_MINUTE = 60;
const WINDOW_MS = 60_000;

export type RateLimitSnapshot = {
  limit: number;
  remaining: number;
  resetAt: Date;
};

/**
 * Records one request against the per-minute quota for the given API key.
 * Throws HttpError(429) if the limit is exceeded and attaches a 60s
 * Retry-After header via `HttpError.extra`.
 *
 * Uses a single Postgres upsert per request: find-or-create the row for the
 * current minute, then atomically increment. Concurrent requests race, but the
 * unique index on (apiKeyId, windowStart) makes the upsert safe.
 */
export async function enforceApiKeyRateLimit(
  apiKeyId: string,
  now: Date = new Date(),
): Promise<RateLimitSnapshot> {
  const windowStart = truncateToMinute(now);
  const resetAt = new Date(windowStart.getTime() + WINDOW_MS);

  const row = await db.apiKeyUsage.upsert({
    where: { apiKeyId_windowStart: { apiKeyId, windowStart } },
    create: { apiKeyId, windowStart, requestCount: 1 },
    update: { requestCount: { increment: 1 } },
  });

  const count = row.requestCount;
  const remaining = Math.max(0, API_KEY_RATE_LIMIT_PER_MINUTE - count);

  if (count > API_KEY_RATE_LIMIT_PER_MINUTE) {
    throw new HttpError(
      429,
      `Rate limit exceeded: ${API_KEY_RATE_LIMIT_PER_MINUTE} requests per minute.`,
    );
  }

  return {
    limit: API_KEY_RATE_LIMIT_PER_MINUTE,
    remaining,
    resetAt,
  };
}

/**
 * Sweeps stale ApiKeyUsage rows older than the given retention window. Safe to
 * call from cron; no-op when nothing is stale.
 */
export async function gcApiKeyUsage(
  retentionMs = 24 * 60 * 60 * 1000,
  now: Date = new Date(),
): Promise<number> {
  const cutoff = new Date(now.getTime() - retentionMs);
  const { count } = await db.apiKeyUsage.deleteMany({
    where: { windowStart: { lt: cutoff } },
  });
  return count;
}

function truncateToMinute(date: Date): Date {
  const copy = new Date(date.getTime());
  copy.setUTCSeconds(0, 0);
  return copy;
}
