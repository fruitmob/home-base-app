import { NextResponse } from "next/server";
import { HttpError, requireAuth } from "@/lib/auth";
import { apiErrorResponse, verifyMutationCsrf } from "@/lib/core/api";
import { revokeApiKey } from "@/lib/api-keys/admin";

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "OWNER" && user.role !== "ADMIN") {
      throw new HttpError(403, "Admin access required.");
    }
    verifyMutationCsrf(request);

    const key = await revokeApiKey(params.id);
    return NextResponse.json({ key });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
