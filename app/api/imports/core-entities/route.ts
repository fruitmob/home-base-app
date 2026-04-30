import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { apiErrorResponse, verifyMutationCsrf } from "@/lib/core/api";

export async function POST(request: Request) {
  try {
    await requireAuth(request);
    verifyMutationCsrf(request);

    return NextResponse.json(
      {
        error: "Core entity CSV import is not implemented yet.",
        message: "Full CSV upload, mapping, validation, and import history are deferred to Module 11.",
        deferredTo: "M11",
      },
      { status: 501 },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
