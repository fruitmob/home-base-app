import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPortalToken } from "@/lib/shop/portal";

export async function POST(
  request: Request,
  { params }: { params: { token: string } }
) {
  try {
    const check = await verifyPortalToken(params.token);
    if (!check.valid || !check.token) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    const { body } = await request.json();
    if (!body || typeof body !== "string" || !body.trim()) {
      return NextResponse.json({ error: "Message body is required" }, { status: 400 });
    }

    const newMessage = await db.portalMessage.create({
      data: {
        body: body.trim(),
        customerId: check.token.customerId!,
        authorType: "CUSTOMER",
      },
      include: {
        author: true, // will be null since it's the customer, but keeps return type consistent
      }
    });

    return NextResponse.json({ success: true, message: newMessage });
  } catch (err) {
    console.error("[POST /api/portal/.../messages]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
