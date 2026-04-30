import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { parseQuoteTemplateInput } from "@/lib/sales/validators";
import { apiErrorResponse, requireSalesWrite } from "@/lib/core/api";
import { logAudit } from "@/lib/audit";
import { findActiveQuoteTemplate } from "@/lib/sales/quotes";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireAuth(request);

    const template = await db.quoteTemplate.findUnique({
      where: { id: params.id },
      include: {
        lineItems: {
          orderBy: { displayOrder: "asc" }
        }
      },
    });

    if (!template || template.deletedAt !== null) {
       return NextResponse.json({ error: "Quote template not found" }, { status: 404 });
    }

    return NextResponse.json({ template });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth(request);
    await requireSalesWrite(request);

    const template = await findActiveQuoteTemplate(params.id);

    const body = await request.json();
    const data = parseQuoteTemplateInput({
      name: template.name,
      description: template.description,
      active: template.active,
      ...body,
    });

    const updated = await db.quoteTemplate.update({
      where: { id: template.id },
      data,
    });

    await logAudit({
      actorUserId: user.id,
      action: "quote.template.update",
      entityType: "QuoteTemplate",
      entityId: template.id,
      before: template,
      after: updated,
    });

    return NextResponse.json({ template: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth(request);
    await requireSalesWrite(request);

    const template = await findActiveQuoteTemplate(params.id);

    await db.quoteTemplate.update({
      where: { id: template.id },
      data: { deletedAt: new Date() },
    });

    await logAudit({
      actorUserId: user.id,
      action: "quote.template.delete",
      entityType: "QuoteTemplate",
      entityId: template.id,
      before: template,
      after: { name: template.name, deleted: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
