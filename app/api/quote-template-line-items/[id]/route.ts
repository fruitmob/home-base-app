import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { apiErrorResponse, requireSalesWrite } from "@/lib/core/api";
import { logAudit } from "@/lib/audit";
import { parseQuoteTemplateLineInput } from "@/lib/sales/validators";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth(request);
    await requireSalesWrite(request);

    const lineItem = await db.quoteTemplateLineItem.findUnique({
      where: { id: params.id },
    });

    if (!lineItem) {
      return NextResponse.json({ error: "Template line item not found" }, { status: 404 });
    }

    const body = await request.json();
    const data = parseQuoteTemplateLineInput({
      productId: lineItem.productId,
      sku: lineItem.sku,
      description: lineItem.description,
      quantity: Number(lineItem.quantity),
      unitPrice: lineItem.unitPrice == null ? null : Number(lineItem.unitPrice),
      taxable: lineItem.taxable,
      displayOrder: lineItem.displayOrder,
      ...body,
    });

    const updated = await db.quoteTemplateLineItem.update({
      where: { id: params.id },
      data,
    });

    await logAudit({
      actorUserId: user.id,
      action: "quote.template.line_item.update",
      entityType: "QuoteTemplate",
      entityId: lineItem.templateId,
      before: lineItem,
      after: updated,
    });

    return NextResponse.json({ lineItem: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth(request);
    await requireSalesWrite(request);

    const lineItem = await db.quoteTemplateLineItem.findUnique({
      where: { id: params.id },
    });

    if (!lineItem) {
      return NextResponse.json({ error: "Template line item not found" }, { status: 404 });
    }

    await db.quoteTemplateLineItem.delete({
      where: { id: params.id },
    });

    await logAudit({
      actorUserId: user.id,
      action: "quote.template.line_item.delete",
      entityType: "QuoteTemplate",
      entityId: lineItem.templateId,
      before: lineItem,
      after: { lineItemId: lineItem.id, deleted: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
