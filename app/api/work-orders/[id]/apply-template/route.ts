import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { apiErrorResponse, readJsonObject } from "@/lib/core/api";
import { db } from "@/lib/db";
import { readRequiredString, requireRecord } from "@/lib/core/validators";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth(request);
    const input = await readJsonObject(request);
    
    const record = requireRecord(input);
    const templateId = readRequiredString(record, "templateId");

    const workOrder = await db.workOrder.findUnique({
      where: { id: params.id, deletedAt: null },
    });

    if (!workOrder) {
      return NextResponse.json({ error: "Work order not found" }, { status: 404 });
    }

    const template = await db.woTemplate.findUnique({
      where: { id: templateId, deletedAt: null, active: true },
      include: {
        lineItems: {
          orderBy: { displayOrder: "asc" },
        },
      },
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found or inactive" }, { status: 404 });
    }

    // Apply template lines to work order by creating them inside a transaction
    await db.$transaction(async (tx) => {
      for (const tline of template.lineItems) {
        // Evaluate price (optional in template). If empty we default to 0.
        const unitPrice = tline.unitPrice != null ? Number(tline.unitPrice) : 0;
        const quantity = Number(tline.quantity);
        const lineTotal = quantity * unitPrice;

        await tx.workOrderLineItem.create({
          data: {
            workOrderId: workOrder.id,
            productId: tline.productId,
            partId: tline.partId,
            lineType: tline.lineType,
            description: tline.description,
            quantity: quantity,
            unitPrice: unitPrice,
            lineTotal: lineTotal,
            taxable: tline.taxable,
            displayOrder: tline.displayOrder, // Preserves the order relative to each other, but typically we append
            status: "OPEN",
          },
        });
      }
    });

    return NextResponse.json({ success: true, count: template.lineItems.length });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
