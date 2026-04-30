import { requireAuth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { apiErrorResponse, requireSalesWrite } from "@/lib/core/api";
import { logAudit } from "@/lib/audit";
import { applyTemplateToQuote, findActiveQuote, requireDraftQuote } from "@/lib/sales/quotes";
import { requireRecord, readRequiredString } from "@/lib/core/validators";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth(request);
    await requireSalesWrite(request);

    const quote = await findActiveQuote(params.id);
    requireDraftQuote(quote);

    const body = await request.json();
    const record = requireRecord(body);
    const templateId = readRequiredString(record, "templateId");

    await applyTemplateToQuote(params.id, templateId);

    await logAudit({
      actorUserId: user.id,
      action: "quote.apply_template",
      entityType: "Quote",
      entityId: params.id,
      after: { templateId },
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
