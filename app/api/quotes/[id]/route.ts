import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { parseQuoteInput } from "@/lib/sales/validators";
import { apiErrorResponse, requireSalesWrite } from "@/lib/core/api";
import { logAudit } from "@/lib/audit";
import { notFound } from "@/lib/core/api";
import { findActiveQuote, requireDraftQuote } from "@/lib/sales/quotes";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireAuth(request);

    const quote = await db.quote.findUnique({
      where: { id: params.id },
      include: {
        customer: true,
        opportunity: true,
        vehicle: true,
        createdByUser: true,
        lineItems: {
          orderBy: { displayOrder: "asc" }
        },
        revisions: {
          where: { deletedAt: null },
          orderBy: { version: "desc" }
        },
        parentQuote: {
          include: {
             revisions: {
                where: { deletedAt: null },
                orderBy: { version: "desc" }
             }
          }
        }
      },
    });

    if (!quote || quote.deletedAt !== null) {
      notFound("Quote not found.");
    }

    return NextResponse.json({ quote });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth(request);
    await requireSalesWrite(request);

    const quote = await findActiveQuote(params.id);
    requireDraftQuote(quote);

    const body = await request.json();
    const data = parseQuoteInput({
      customerId: quote.customerId,
      vehicleId: quote.vehicleId,
      opportunityId: quote.opportunityId,
      pricebookId: quote.pricebookId,
      validUntil: quote.validUntil?.toISOString() ?? null,
      notes: quote.notes,
      ...body,
    });

    const updated = await db.quote.update({
      where: { id: quote.id },
      data,
    });

    await logAudit({
      actorUserId: user.id,
      action: "quote.update",
      entityType: "Quote",
      entityId: quote.id,
      before: quote,
      after: updated,
    });

    return NextResponse.json({ quote: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth(request);
    await requireSalesWrite(request);

    const quote = await findActiveQuote(params.id);

    await db.quote.update({
      where: { id: quote.id },
      data: { deletedAt: new Date() },
    });

    await logAudit({
      actorUserId: user.id,
      action: "quote.delete",
      entityType: "Quote",
      entityId: quote.id,
      before: quote,
      after: { quoteNumber: quote.quoteNumber, deleted: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
