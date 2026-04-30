import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPortalToken } from "@/lib/shop/portal";

export async function POST(
  request: Request,
  { params }: { params: { token: string; id: string } }
) {
  try {
    const check = await verifyPortalToken(params.token);
    if (!check.valid || !check.token) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    const estimate = await db.estimate.findUnique({
      where: { id: params.id },
    });

    if (!estimate || estimate.status !== "SENT") {
      return NextResponse.json({ error: "Estimate not found or not in pending state" }, { status: 400 });
    }

    if (estimate.customerId !== check.token.customerId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Capture standard IP/Agent from headers for e-signature tracking
    const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "0.0.0.0";
    const userAgent = request.headers.get("user-agent") || "Unknown";

    await db.$transaction(async (tx) => {
      await tx.estimate.update({
        where: { id: estimate.id },
        data: { status: "APPROVED" },
      });

      await tx.estimateApproval.create({
        data: {
          estimateId: estimate.id,
          ipAddress,
          userAgent,
        },
      });
      
      // If estimate is associated with a Work Order, log status history maybe?
      // Since it's a quote logic, we'll keep it simple for now. 
      // Shop staff will see the status change.
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const err = error as Error;
    console.error("[POST /api/portal/.../approve]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
