import { GET } from "@/app/api/health/route";

async function main() {
  const response = await GET();
  const body = (await response.json()) as { ok?: boolean; db?: number };

  if (response.status !== 200 || !body.ok) {
    throw new Error(`Health smoke test failed: status=${response.status} body=${JSON.stringify(body)}`);
  }

  if (typeof body.db !== "number" || body.db >= 500) {
    throw new Error(`Health smoke test failed: expected db latency under 500ms, got ${body.db}.`);
  }

  console.log(`Health smoke test: OK (${body.db}ms)`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
