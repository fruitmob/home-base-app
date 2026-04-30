import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { parseQuoteInput } from "@/lib/sales/validators";
import { withQuoteNumberRetry } from "@/lib/sales/quoteNumber";
import { apiErrorResponse, requireSalesWrite } from "@/lib/core/api";
import { logAudit } from "@/lib/audit";
import { Prisma } from "@/generated/prisma/client";

export async function GET(request: Request) {
  try {
    await requireAuth(request);
    const { searchParams } = new URL(request.url);

    const customerId = searchParams.get("customerId");
    const opportunityId = searchParams.get("opportunityId");
    const status = searchParams.get("status");
    const q = searchParams.get("q");

    const where: Prisma.QuoteWhereInput = {
      deletedAt: null,
    };

    if (customerId) where.customerId = customerId;
    if (opportunityId) where.opportunityId = opportunityId;
    if (status) where.status = status as any /* eslint-disable-line */;
    if (q) {
      where.quoteNumber = { contains: q, mode: "insensitive" };
    }

    const quotes = await db.quote.findMany({
      where,
      include: {
        customer: { select: { id: true, displayName: true } },
        createdByUser: { select: { id: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ quotes });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth(request);
    const user = await requireSalesWrite(request);

    const body = await request.json();
    const data = parseQuoteInput(body);

    const quote = await withQuoteNumberRetry(async (nextQuoteNumber) => {
      return db.quote.create({
        data: {
          quoteNumber: nextQuoteNumber,
          ...data,
          status: "DRAFT",
          subtotal: 0,
          taxTotal: 0,
          total: 0,
          createdByUserId: user.id,
        },
      });
    });

    await logAudit({
      actorUserId: user.id,
      action: "quote.create",
      entityType: "Quote",
      entityId: quote.id,
      after: { quoteNumber: quote.quoteNumber },
    });

    return NextResponse.json({ quote }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
