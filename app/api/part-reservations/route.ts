import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { reservePart } from "@/lib/shop/parts";


export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);

    const data = await request.json();

    if (!data.partId || !data.workOrderId || !data.quantity) {
      return NextResponse.json({ error: "Missing partId, workOrderId, or quantity" }, { status: 400 });
    }

    if (Number(data.quantity) <= 0) {
      return NextResponse.json({ error: "Reservation quantity must be strictly positive" }, { status: 400 });
    }

    // Attempt to make reservation, will throw if insufficient stock
    const reservation = await reservePart(
      data.partId,
      data.quantity,
      data.workOrderId,
      data.lineItemId, // optional
      { userId: user.id }
    );

    return NextResponse.json(reservation, { status: 201 });
  } catch (error: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
    if (error.message && error.message.includes("exceeds available stock")) {
      return NextResponse.json({ error: "Not enough stock to fulfill this reservation" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message || "Failed to create reservation" }, { status: 500 });
  }
}
