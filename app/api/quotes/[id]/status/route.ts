import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { apiErrorResponse, requireSalesWrite } from "@/lib/core/api";
import { logAudit } from "@/lib/audit";
import { findActiveQuote } from "@/lib/sales/quotes";
import { QuoteStatus } from "@/generated/prisma/client";
import { parseEnum, requireRecord } from "@/lib/core/validators";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth(request);
    await requireSalesWrite(request);

    const quote = await findActiveQuote(params.id);
    const body = requireRecord(await request.json());
    const status = parseEnum(body.status, QuoteStatus, "status", QuoteStatus.DRAFT);

    if (quote.status === status) {
      return NextResponse.json({ quote });
    }

    const allowedTargets: QuoteStatus[] =
      quote.status === QuoteStatus.DRAFT
        ? [QuoteStatus.SENT]
        : quote.status === QuoteStatus.SENT
          ? [QuoteStatus.ACCEPTED, QuoteStatus.DECLINED, QuoteStatus.EXPIRED]
          : [];

    if (!allowedTargets.includes(status)) {
      return NextResponse.json(
        { error: "Invalid quote status transition." },
        { status: 400 },
      );
    }

    const updated = await db.quote.update({
      where: { id: quote.id },
      data: {
        status,
        ...(status === QuoteStatus.SENT ? { issuedAt: new Date() } : {}),
      },
    });

    await logAudit({
      actorUserId: user.id,
      action: "quote.status",
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
