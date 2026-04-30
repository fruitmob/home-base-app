import { NextResponse } from "next/server";
import { HttpError, requireAuth } from "@/lib/auth";
import { apiErrorResponse, readJsonObject, verifyMutationCsrf } from "@/lib/core/api";
import { deleteWebhookEndpoint, updateWebhookEndpoint } from "@/lib/webhooks/admin";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "OWNER" && user.role !== "ADMIN") {
      throw new HttpError(403, "Admin access required.");
    }
    verifyMutationCsrf(request);

    const body = await readJsonObject(request);
    const result = await updateWebhookEndpoint(params.id, {
      label: typeof body.label === "string" ? body.label : undefined,
      url: typeof body.url === "string" ? body.url : undefined,
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      eventTypes: Array.isArray(body.eventTypes) ? (body.eventTypes as string[]) : undefined,
      rotateSecret: body.rotateSecret === true,
    });

    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "OWNER" && user.role !== "ADMIN") {
      throw new HttpError(403, "Admin access required.");
    }
    verifyMutationCsrf(request);

    await deleteWebhookEndpoint(params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
