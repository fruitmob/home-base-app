import { requireSalesWrite } from "@/lib/core/api";
import { NextResponse } from "next/server";
import { Prisma, OpportunityStage } from "@/generated/prisma/client";
import {
  apiErrorResponse,
  readJsonObject,
  readRequiredStringField,
} from "@/lib/core/api";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { findActiveOpportunity, canMutateOpportunity } from "@/lib/sales/opportunities";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireSalesWrite(request);
    const opportunity = await findActiveOpportunity(params.id);

    if (!canMutateOpportunity(user, opportunity.ownerUserId)) {
      return NextResponse.json({ error: "Forbidden: You do not have permission to edit this opportunity." }, { status: 403 });
    }

    const body = await readJsonObject(request);
    const newStageRaw = readRequiredStringField(body, "stage");
    
    if (!Object.values(OpportunityStage).includes(newStageRaw as OpportunityStage)) {
       return NextResponse.json({ error: "Invalid stage provided." }, { status: 400 });
    }
    
    const newStage = newStageRaw as OpportunityStage;

    // Reject transitions if the opportunity is already closed
    if (opportunity.stage === OpportunityStage.WON || opportunity.stage === OpportunityStage.LOST) {
      return NextResponse.json({ error: "Cannot change stage of an already closed opportunity." }, { status: 400 });
    }
    
    // No-op
    if (opportunity.stage === newStage) {
      return NextResponse.json(opportunity);
    }

    const data: Prisma.OpportunityUpdateInput = {
      stage: newStage,
    };

    if (newStage === OpportunityStage.WON || newStage === OpportunityStage.LOST) {
      data.closedAt = new Date();
    }

    const updated = await db.opportunity.update({
      where: { id: opportunity.id },
      data,
    });

    await logAudit({
      action: "opportunity.stage",
      entityType: "Opportunity",
      entityId: opportunity.id,
      actorUserId: user.id,
      before: opportunity,
      after: updated,
    });

    return NextResponse.json(updated);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
