import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/core/api";
import { deleteFeatureFlag, updateFeatureFlag } from "@/lib/admin/flags";

type RouteContext = { params: { id: string } };

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();

    const updated = await updateFeatureFlag(
      params.id,
      {
        ...(body.label !== undefined ? { label: String(body.label) } : {}),
        ...(body.description !== undefined ? { description: String(body.description) } : {}),
        ...(body.enabled !== undefined ? { enabled: Boolean(body.enabled) } : {}),
      },
      user,
      request,
    );

    return NextResponse.json({ flag: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const user = await requireAuth(request);
    await deleteFeatureFlag(params.id, user, request);
    return new Response(null, { status: 204 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
