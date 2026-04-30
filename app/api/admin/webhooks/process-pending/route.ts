import { NextResponse } from "next/server";
import { HttpError, requireAuth } from "@/lib/auth";
import { apiErrorResponse, verifyMutationCsrf } from "@/lib/core/api";
import { processPendingDeliveries } from "@/lib/webhooks/dispatch";

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "OWNER" && user.role !== "ADMIN") {
      throw new HttpError(403, "Admin access required.");
    }
    verifyMutationCsrf(request);

    const results = await processPendingDeliveries(25);
    return NextResponse.json({ processed: results.length, results });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
