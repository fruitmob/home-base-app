import { NextResponse } from "next/server";
import { isHttpError, requireAuth } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);

    return NextResponse.json({ user });
  } catch (error) {
    if (isHttpError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
