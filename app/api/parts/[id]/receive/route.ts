import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { receivePart } from "@/lib/shop/parts";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth(request);

    const data = await request.json();

    if (!data.quantity || Number(data.quantity) <= 0) {
      return NextResponse.json({ error: "Receive quantity must be greater than zero." }, { status: 400 });
    }

    const transaction = await receivePart(
      params.id,
      data.quantity,
      data.unitCost,
      data.reference,
      data.note,
      { userId: user.id, vendorId: data.vendorId }
    );

    return NextResponse.json(transaction, { status: 201 });
  } catch (error: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
    return NextResponse.json({ error: error.message || "Failed to receive part" }, { status: 500 });
  }
}
