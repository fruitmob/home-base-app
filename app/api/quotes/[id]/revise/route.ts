import { requireAuth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { apiErrorResponse, requireSalesWrite } from "@/lib/core/api";
import { logAudit } from "@/lib/audit";
import { reviseQuote } from "@/lib/sales/quotes";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth(request);
    await requireSalesWrite(request);

    const newQuote = await reviseQuote(params.id, user.id);

    await logAudit({
      actorUserId: user.id,
      action: "quote.revise",
      entityType: "Quote",
      entityId: newQuote.id,
      after: { parentQuoteId: params.id, version: newQuote.version },
    });

    return NextResponse.json({ quote: newQuote }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
