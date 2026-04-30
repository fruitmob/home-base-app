import { NextResponse } from "next/server";
import { apiErrorResponse, requireCustomerWrite } from "@/lib/core/api";
import { sendPortalLinkToCustomer } from "@/lib/shop/portal";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireCustomerWrite(request);

    const url = new URL(request.url);
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `${url.protocol}//${url.host}`;

    const { token, emailRes } = await sendPortalLinkToCustomer(params.id, baseUrl);

    return NextResponse.json({
      success: true,
      token,
      emailSendId: emailRes.send.id,
      emailStatus: emailRes.send.status,
      emailProviderMessageId: emailRes.send.providerMessageId,
    });
  } catch (error) {
    const err = error as Error;
    if (err.message === "Customer not found") {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }
    if (err.message === "Customer has no email address on file.") {
      return NextResponse.json(
        { error: "Customer has no email address on file. Please update their profile first." },
        { status: 400 }
      );
    }

    try {
      return apiErrorResponse(error);
    } catch {
      // Fall through to the generic response for unexpected mail/provider failures.
    }
    
    console.error("[POST /api/customers/[id]/portal-link]", err);
    return NextResponse.json({ error: "Failed to generate portal link" }, { status: 500 });
  }
}
