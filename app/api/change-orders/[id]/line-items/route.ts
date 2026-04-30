import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { apiErrorResponse, readJsonObject } from "@/lib/core/api";
import { db } from "@/lib/db";
import { parseChangeOrderLineInput } from "@/lib/shop/validators";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth(request);

    const changeOrder = await db.changeOrder.findUnique({
      where: { id: params.id, deletedAt: null },
    });

    if (!changeOrder) {
      return NextResponse.json({ error: "Change order not found" }, { status: 404 });
    }

    const lineItems = await db.changeOrderLineItem.findMany({
      where: { changeOrderId: params.id, deletedAt: null },
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
    const data = parseChangeOrderLineInput(input);

    const changeOrder = await db.changeOrder.findUnique({
      where: { id: params.id, deletedAt: null },
    });

    if (!changeOrder) {
      return NextResponse.json({ error: "Change order not found" }, { status: 404 });
    }

    if (changeOrder.status !== "DRAFT") {
      return NextResponse.json({ error: "Cannot add line items to a non-draft change order." }, { status: 400 });
    }

    const lineItem = await db.$transaction(async (tx) => {
      const line = await tx.changeOrderLineItem.create({
        data: {
          changeOrderId: params.id,
          ...data,
        },
      });

      // Recalculate totals
      const allLines = await tx.changeOrderLineItem.findMany({
        where: { changeOrderId: params.id, deletedAt: null },
      });

      const subtotal = allLines.reduce((sum, item) => sum + Number(item.lineTotal), 0);
      const taxTotal = allLines
        .filter((item) => item.taxable)
        .reduce((sum, item) => sum + (Number(item.lineTotal) * 0.08), 0); // Flat 8% tax rate for now

      await tx.changeOrder.update({
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
