import { NextResponse } from "next/server";
import { HttpError, requireAuth } from "@/lib/auth";
import { apiErrorResponse, readJsonObject, verifyMutationCsrf } from "@/lib/core/api";
import {
  createWebhookEndpoint,
  listRecentWebhookDeliveries,
  listWebhookEndpointsForAdmin,
} from "@/lib/webhooks/admin";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "OWNER" && user.role !== "ADMIN") {
      throw new HttpError(403, "Admin access required.");
    }

    const [endpoints, deliveries] = await Promise.all([
      listWebhookEndpointsForAdmin(),
      listRecentWebhookDeliveries(50),
    ]);
    return NextResponse.json({ endpoints, deliveries });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "OWNER" && user.role !== "ADMIN") {
      throw new HttpError(403, "Admin access required.");
    }
    verifyMutationCsrf(request);

    const body = await readJsonObject(request);
    const result = await createWebhookEndpoint({
      label: String(body.label ?? ""),
      url: String(body.url ?? ""),
      eventTypes: Array.isArray(body.eventTypes) ? (body.eventTypes as string[]) : [],
      createdByUserId: user.id,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
