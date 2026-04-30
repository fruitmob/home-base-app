import { requireAuth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { generateQuotePdf } from "@/lib/sales/quotePdf";
import { findActiveQuote } from "@/lib/sales/quotes";
import { apiErrorResponse } from "@/lib/core/api";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth(request);

    const quote = await findActiveQuote(params.id);

    const pdfBytes = await generateQuotePdf(quote.id);

    await logAudit({
      actorUserId: user.id,
      action: "quote.pdf",
      entityType: "Quote",
      entityId: quote.id,
      after: { quoteNumber: quote.quoteNumber },
    });

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="quote-${quote.quoteNumber}.pdf"`,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
