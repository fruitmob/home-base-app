import { NextResponse } from "next/server";
import { gcApiKeyUsage } from "@/lib/api-keys/rate-limit";
import { apiErrorResponse } from "@/lib/core/api";
import { requireCronSecret } from "@/lib/cron/auth";
import { processPendingDeliveries } from "@/lib/webhooks/dispatch";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}

async function handle(request: Request) {
  try {
    requireCronSecret(request);
    const results = await processPendingDeliveries(50);
    const usageRowsSwept = await gcApiKeyUsage().catch((error) => {
      console.error("[cron] apiKeyUsage gc failed", error);
      return 0;
    });
    return NextResponse.json({
      processed: results.length,
      succeeded: results.filter((r) => r.status === "SUCCEEDED").length,
      pending: results.filter((r) => r.status === "PENDING").length,
      permanentlyFailed: results.filter((r) => r.status === "PERMANENTLY_FAILED").length,
      usageRowsSwept,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
