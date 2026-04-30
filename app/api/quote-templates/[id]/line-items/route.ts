import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { apiErrorResponse, requireSalesWrite } from "@/lib/core/api";
import { logAudit } from "@/lib/audit";
import { findActiveQuoteTemplate } from "@/lib/sales/quotes";
import { parseQuoteTemplateLineInput } from "@/lib/sales/validators";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth(request);
    await requireSalesWrite(request);
    const template = await findActiveQuoteTemplate(params.id);

    const body = await request.json();
    const data = parseQuoteTemplateLineInput(body);

    const lineItem = await db.quoteTemplateLineItem.create({
      data: {
        templateId: template.id,
        ...data,
      },
    });

    await logAudit({
      actorUserId: user.id,
      action: "quote.template.line_item.create",
      entityType: "QuoteTemplate",
      entityId: template.id,
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
    const template = await findActiveQuoteTemplate(params.id);

    const body = await request.json();

    if (!body.order || typeof body.order !== 'object') {
       return NextResponse.json({ error: "Invalid payload: missing order object." }, { status: 400 });
    }

    const updates = Object.entries(body.order as Record<string, number>).map(([id, displayOrder]) => {
       return db.quoteTemplateLineItem.update({
          where: { id, templateId: template.id },
          data: { displayOrder }
       });
    });

    await db.$transaction(updates);

    await logAudit({
      actorUserId: user.id,
      action: "quote.template.line_item.reorder",
      entityType: "QuoteTemplate",
      entityId: template.id,
      after: {},
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
