import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { IMPERSONATION_COOKIE_NAME } from "@/lib/authConstants";
import { apiErrorResponse } from "@/lib/core/api";
import { startImpersonation, stopImpersonation } from "@/lib/admin/impersonation";
import { getCookieValue } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();

    const imp = await startImpersonation(
      String(body.targetUserId ?? ""),
      String(body.reason ?? ""),
      user,
      request,
    );

    const impCookieExpiry = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4-hour cap
    cookies().set(IMPERSONATION_COOKIE_NAME, imp.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: impCookieExpiry,
    });

    return NextResponse.json({ impersonation: imp }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireAuth(request);
    const impersonationId = getCookieValue(request, IMPERSONATION_COOKIE_NAME);

    if (impersonationId) {
      await stopImpersonation(impersonationId, user, request);
    }

    cookies().set(IMPERSONATION_COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
