import { NextResponse } from "next/server";
import { HttpError, requireAuth } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/core/api";
import { createFeatureFlag, listFeatureFlags } from "@/lib/admin/flags";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "OWNER" && user.role !== "ADMIN") {
      throw new HttpError(403, "Admin access required.");
    }

    const flags = await listFeatureFlags();
    return NextResponse.json({ flags });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();

    const flag = await createFeatureFlag(
      {
        key: String(body.key ?? ""),
        label: String(body.label ?? ""),
        description: body.description ? String(body.description) : undefined,
        enabled: body.enabled === true,
      },
      user,
      request,
    );

    return NextResponse.json({ flag }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
