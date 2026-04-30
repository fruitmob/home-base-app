/**
 * Home Base post-deploy smoke harness
 *
 * Usage
 *   HOMEBASE_BASE_URL="https://cedarridge.homebase.dev" \
 *   HOMEBASE_API_KEY="hbk_..." \
 *   npx tsx scripts/deploy-smoke.ts
 *
 * Checks
 *   1. GET /api/health returns 200 with { ok: true }.
 *   2. GET /api/public/v1/customers with Bearer auth returns 200.
 *   3. GET /api/public/v1/vehicles with Bearer auth returns 200.
 *   4. GET /api/public/v1/work-orders with Bearer auth returns 200.
 *   5. GET /api/public/v1/estimates with Bearer auth returns 200.
 *
 * The harness is intentionally read-only. It does not mutate any state on the
 * target deployment — safe to run against prod during or after a cutover.
 *
 * Exit codes
 *   0  All checks passed.
 *   1  At least one check failed (details printed to stdout).
 */

type CheckResult = {
  name: string;
  ok: boolean;
  details: string;
};

async function main() {
  const baseUrl = requireEnv("HOMEBASE_BASE_URL").replace(/\/$/, "");
  const apiKey = requireEnv("HOMEBASE_API_KEY");

  console.log(`Home Base post-deploy smoke against ${baseUrl}`);

  const results: CheckResult[] = [];

  results.push(await checkHealth(baseUrl));

  for (const slug of ["customers", "vehicles", "work-orders", "estimates"]) {
    results.push(await checkPublicRead(baseUrl, apiKey, slug));
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;

  for (const result of results) {
    const marker = result.ok ? "PASS" : "FAIL";
    console.log(`  [${marker}] ${result.name} — ${result.details}`);
  }

  console.log(`\n${passed}/${results.length} checks passed.`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

async function checkHealth(baseUrl: string): Promise<CheckResult> {
  const name = "GET /api/health";
  try {
    const response = await fetchWithTimeout(`${baseUrl}/api/health`);
    if (!response.ok) {
      return { name, ok: false, details: `HTTP ${response.status}` };
    }
    const body = (await response.json()) as { ok?: boolean; db?: number };
    if (body.ok !== true) {
      return { name, ok: false, details: "response body did not report ok=true" };
    }
    return { name, ok: true, details: `ok (db ${body.db ?? "?"}ms)` };
  } catch (error) {
    return { name, ok: false, details: stringifyError(error) };
  }
}

async function checkPublicRead(
  baseUrl: string,
  apiKey: string,
  slug: string,
): Promise<CheckResult> {
  const name = `GET /api/public/v1/${slug}`;
  try {
    const response = await fetchWithTimeout(`${baseUrl}/api/public/v1/${slug}?limit=1`, {
      headers: { authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) {
      const snippet = await safeReadText(response, 200);
      return {
        name,
        ok: false,
        details: `HTTP ${response.status}${snippet ? ` — ${snippet}` : ""}`,
      };
    }
    const body = (await response.json()) as {
      data?: unknown[];
      meta?: { total?: number; limit?: number };
    };
    if (!Array.isArray(body.data) || !body.meta) {
      return { name, ok: false, details: "response shape did not match { data, meta }" };
    }
    return { name, ok: true, details: `total ${body.meta.total ?? "?"}, returned ${body.data.length}` };
  } catch (error) {
    return { name, ok: false, details: stringifyError(error) };
  }
}

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function safeReadText(response: Response, limit: number): Promise<string> {
  try {
    const text = await response.text();
    return text.length > limit ? `${text.slice(0, limit)}…` : text;
  } catch {
    return "";
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    console.error(`Missing required env var: ${name}`);
    process.exit(2);
  }
  return value.trim();
}

function stringifyError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "unknown error";
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
