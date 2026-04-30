import { NextResponse } from "next/server";
import { HttpError, requireAuth } from "@/lib/auth";
import { apiErrorResponse, readJsonObject, verifyMutationCsrf } from "@/lib/core/api";
import { issueApiKeyForAdmin, listApiKeysForAdmin } from "@/lib/api-keys/admin";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "OWNER" && user.role !== "ADMIN") {
      throw new HttpError(403, "Admin access required.");
    }
    const keys = await listApiKeysForAdmin();
    return NextResponse.json({ keys });
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
    const result = await issueApiKeyForAdmin({
      label: String(body.label ?? ""),
      scopes: Array.isArray(body.scopes) ? (body.scopes as string[]) : [],
      createdByUserId: user.id,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
