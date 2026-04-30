import { NextResponse } from "next/server";
import { isHttpError } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/core/api";
import { authenticateApiKey, requireScope } from "@/lib/api-keys/authenticate";
import {
  API_KEY_RATE_LIMIT_PER_MINUTE,
  enforceApiKeyRateLimit,
  type RateLimitSnapshot,
} from "@/lib/api-keys/rate-limit";
import type { ApiKeyScope } from "@/lib/api-keys/scopes";

export const PUBLIC_DEFAULT_LIMIT = 25;
export const PUBLIC_MAX_LIMIT = 100;

export type PublicListParams = {
  limit: number;
  offset: number;
};

export function readListParams(url: URL): PublicListParams {
  const limitRaw = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
  const offsetRaw = Number.parseInt(url.searchParams.get("offset") ?? "", 10);

  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(limitRaw, PUBLIC_MAX_LIMIT)
      : PUBLIC_DEFAULT_LIMIT;
  const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;

  return { limit, offset };
}

export async function withPublicApi<T>(
  request: Request,
  scope: ApiKeyScope,
  handler: (args: { url: URL; params: PublicListParams }) => Promise<T>,
): Promise<Response> {
  let snapshot: RateLimitSnapshot | null = null;
  try {
    const key = await authenticateApiKey(request);
    requireScope(key, scope);
    snapshot = await enforceApiKeyRateLimit(key.id);

    const url = new URL(request.url);
    const params = readListParams(url);
    const body = await handler({ url, params });

    return decorateRateLimitHeaders(NextResponse.json(body), snapshot);
  } catch (error) {
    const response = apiErrorResponse(error);
    if (isHttpError(error) && error.status === 429) {
      response.headers.set("Retry-After", "60");
    }
    return decorateRateLimitHeaders(response, snapshot);
  }
}

function decorateRateLimitHeaders(
  response: Response,
  snapshot: RateLimitSnapshot | null,
): Response {
  if (!snapshot) {
    response.headers.set("X-RateLimit-Limit", String(API_KEY_RATE_LIMIT_PER_MINUTE));
    return response;
  }
  response.headers.set("X-RateLimit-Limit", String(snapshot.limit));
  response.headers.set("X-RateLimit-Remaining", String(snapshot.remaining));
  response.headers.set(
    "X-RateLimit-Reset",
    String(Math.floor(snapshot.resetAt.getTime() / 1000)),
  );
  return response;
}
