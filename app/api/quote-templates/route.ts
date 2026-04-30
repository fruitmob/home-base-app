import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { parseQuoteTemplateInput } from "@/lib/sales/validators";
import { apiErrorResponse, requireSalesWrite } from "@/lib/core/api";
import { logAudit } from "@/lib/audit";

export async function GET(request: Request) {
  try {
    await requireAuth(request);

    const templates = await db.quoteTemplate.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ templates });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth(request);
    const user = await requireSalesWrite(request);

    const body = await request.json();
    const data = parseQuoteTemplateInput(body);

    const template = await db.quoteTemplate.create({
      data,
    });

    await logAudit({
      actorUserId: user.id,
      action: "quote.template.create",
      entityType: "QuoteTemplate",
      entityId: template.id,
      after: { name: template.name },
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
