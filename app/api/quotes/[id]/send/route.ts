import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { apiErrorResponse, requireSalesWrite } from "@/lib/core/api";
import { logAudit } from "@/lib/audit";
import { findActiveQuote } from "@/lib/sales/quotes";
import { QuoteStatus } from "@/generated/prisma/client";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth(request);
    await requireSalesWrite(request);

    const quote = await findActiveQuote(params.id);

    if (quote.status !== QuoteStatus.DRAFT) {
      return NextResponse.json({ error: "Only draft quotes can be sent." }, { status: 400 });
    }

    const updated = await db.quote.update({
      where: { id: quote.id },
      data: {
        status: QuoteStatus.SENT,
        issuedAt: new Date(),
      },
    });

    await logAudit({
      actorUserId: user.id,
      action: "quote.send",
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
