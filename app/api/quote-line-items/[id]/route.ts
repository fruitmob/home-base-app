import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { apiErrorResponse, requireSalesWrite } from "@/lib/core/api";
import { logAudit } from "@/lib/audit";
import { findActiveQuote, recomputeQuoteTotals, requireDraftQuote } from "@/lib/sales/quotes";
import { parseQuoteLineInput } from "@/lib/sales/validators";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth(request);
    await requireSalesWrite(request);

    const lineItem = await db.quoteLineItem.findUnique({
      where: { id: params.id },
    });

    if (!lineItem) {
      return NextResponse.json({ error: "Line item not found" }, { status: 404 });
    }

    const quote = await findActiveQuote(lineItem.quoteId);
    requireDraftQuote(quote);

    const body = await request.json();
    const data = parseQuoteLineInput({
      productId: lineItem.productId,
      sku: lineItem.sku,
      description: lineItem.description,
      quantity: Number(lineItem.quantity),
      unitPrice: Number(lineItem.unitPrice),
      taxable: lineItem.taxable,
      displayOrder: lineItem.displayOrder,
      ...body,
    });

    const updated = await db.quoteLineItem.update({
      where: { id: params.id },
      data,
    });

    await recomputeQuoteTotals(lineItem.quoteId);

    await logAudit({
      actorUserId: user.id,
      action: "quote.line_item.update",
      entityType: "Quote",
      entityId: lineItem.quoteId,
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

    const lineItem = await db.quoteLineItem.findUnique({
      where: { id: params.id },
    });

    if (!lineItem) {
      return NextResponse.json({ error: "Line item not found" }, { status: 404 });
    }

    const quote = await findActiveQuote(lineItem.quoteId);
    requireDraftQuote(quote);

    await db.quoteLineItem.delete({
      where: { id: params.id },
    });

    await recomputeQuoteTotals(lineItem.quoteId);

    await logAudit({
      actorUserId: user.id,
      action: "quote.line_item.delete",
      entityType: "Quote",
      entityId: lineItem.quoteId,
      before: lineItem,
      after: { lineItemId: lineItem.id, deleted: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
