import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { issuePartReservation } from "@/lib/shop/parts";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth(request);
    
    // We expect the quantity to issue to be passed
    const data = await request.json();

    if (!data.quantity || Number(data.quantity) <= 0) {
      return NextResponse.json({ error: "Invalid issue quantity" }, { status: 400 });
    }

    const transaction = await issuePartReservation(params.id, data.quantity, { userId: user.id });

    return NextResponse.json(transaction, { status: 200 });
  } catch (error: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
    if (error.code === 'P2025') {
       return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }
    return NextResponse.json({ error: error.message || "Failed to issue reservation" }, { status: 500 });
  }
}
