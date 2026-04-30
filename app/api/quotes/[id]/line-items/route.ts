import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { apiErrorResponse, requireSalesWrite } from "@/lib/core/api";
import { logAudit } from "@/lib/audit";
import { findActiveQuote, recomputeQuoteTotals, requireDraftQuote } from "@/lib/sales/quotes";
import { parseQuoteLineInput } from "@/lib/sales/validators";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth(request);
    await requireSalesWrite(request);
    const quote = await findActiveQuote(params.id);
    requireDraftQuote(quote);

    const body = await request.json();
    const data = parseQuoteLineInput(body);

    const lineItem = await db.quoteLineItem.create({
      data: {
        quoteId: quote.id,
        ...data,
      },
    });

    await recomputeQuoteTotals(quote.id);

    await logAudit({
      actorUserId: user.id,
      action: "quote.line_item.create",
      entityType: "Quote",
      entityId: quote.id,
      after: { lineItemId: lineItem.id },
    });

    return NextResponse.json({ lineItem }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth(request);
    await requireSalesWrite(request);
    const quote = await findActiveQuote(params.id);
    requireDraftQuote(quote);

    const body = await request.json();

    // Format { order: { [lineItemId]: newDisplayOrder } }
    if (!body.order || typeof body.order !== 'object') {
       return NextResponse.json({ error: "Invalid payload: missing order object." }, { status: 400 });
    }

    const updates = Object.entries(body.order as Record<string, number>).map(([id, displayOrder]) => {
       return db.quoteLineItem.update({
          where: { id, quoteId: quote.id },
          data: { displayOrder }
       });
    });

    await db.$transaction(updates);

    await logAudit({
      actorUserId: user.id,
      action: "quote.line_item.reorder",
      entityType: "Quote",
      entityId: quote.id,
      after: {},
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
