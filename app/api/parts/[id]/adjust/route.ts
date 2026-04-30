import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { adjustPartQuantity } from "@/lib/shop/parts";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth(request);

    const data = await request.json();

    if (data.quantityDelta === undefined) {
      return NextResponse.json({ error: "quantityDelta must be provided." }, { status: 400 });
    }

    const transaction = await adjustPartQuantity(
      params.id,
      data.quantityDelta,
      data.reference,
      data.note,
      { userId: user.id }
    );

    return NextResponse.json(transaction, { status: 201 });
  } catch (error: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
    return NextResponse.json({ error: error.message || "Failed to adjust part quantity" }, { status: 400 });
  }
}
