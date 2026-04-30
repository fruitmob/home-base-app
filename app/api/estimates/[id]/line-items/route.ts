import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { apiErrorResponse, readJsonObject } from "@/lib/core/api";
import { db } from "@/lib/db";
import { parseEstimateLineInput } from "@/lib/shop/validators";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth(request);

    const estimate = await db.estimate.findUnique({
      where: { id: params.id, deletedAt: null },
    });

    if (!estimate) {
      return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
    }

    const lineItems = await db.estimateLineItem.findMany({
      where: { estimateId: params.id, deletedAt: null },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({ lineItems });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth(request);
    const input = await readJsonObject(request);
    const data = parseEstimateLineInput(input);

    const estimate = await db.estimate.findUnique({
      where: { id: params.id, deletedAt: null },
    });

    if (!estimate) {
      return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
    }

    if (estimate.status !== "DRAFT") {
      return NextResponse.json({ error: "Cannot add line items to a non-draft estimate." }, { status: 400 });
    }

    const lineItem = await db.$transaction(async (tx) => {
      const line = await tx.estimateLineItem.create({
        data: {
          estimateId: params.id,
          ...data,
        },
      });

      // Recalculate totals
      const allLines = await tx.estimateLineItem.findMany({
        where: { estimateId: params.id, deletedAt: null },
      });

      const subtotal = allLines.reduce((sum, item) => sum + Number(item.lineTotal), 0);
      const taxTotal = allLines
        .filter((item) => item.taxable)
        .reduce((sum, item) => sum + (Number(item.lineTotal) * 0.08), 0); // Flat 8% tax rate for now

      await tx.estimate.update({
        where: { id: params.id },
        data: {
          subtotal,
          taxTotal,
          total: subtotal + taxTotal,
        },
      });

      return line;
    });

    return NextResponse.json({ lineItem }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
