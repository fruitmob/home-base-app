import { requireSalesWrite } from "@/lib/core/api";
import { NextResponse } from "next/server";
import { Prisma, Role } from "@/generated/prisma/client";
import { requireAuth } from "@/lib/auth";
import {
  apiErrorResponse,
  readJsonObject,
} from "@/lib/core/api";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { findActiveOpportunity, canMutateOpportunity } from "@/lib/sales/opportunities";
import { parseOpportunityInput } from "@/lib/sales/validators";

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth(request);
    const opportunity = await findActiveOpportunity(params.id);

    if (!canMutateOpportunity(user, opportunity.ownerUserId)) {
      return NextResponse.json({ error: "Forbidden: You do not have permission to view this opportunity." }, { status: 403 });
    }

    return NextResponse.json(opportunity);
  } catch (error) {
    return apiErrorResponse(error);
  }
}

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
    const input = parseOpportunityInput({
      customerId: opportunity.customerId,
      vehicleId: opportunity.vehicleId,
      ownerUserId: opportunity.ownerUserId,
      name: opportunity.name,
      stage: opportunity.stage,
      amount: Number(opportunity.amount),
      probability: opportunity.probability,
      expectedCloseDate: opportunity.expectedCloseDate?.toISOString() ?? null,
      notes: opportunity.notes,
      ...body,
    });

    if (user.role === Role.SALES_REP && input.ownerUserId && input.ownerUserId !== user.id) {
      return NextResponse.json(
        { error: "Sales reps can only assign opportunities to themselves or leave them unassigned." },
        { status: 403 },
      );
    }

    const data: Prisma.OpportunityUncheckedUpdateInput = {
      customerId: input.customerId,
      vehicleId: input.vehicleId,
      ownerUserId: input.ownerUserId,
      name: input.name,
      amount: input.amount,
      probability: input.probability,
      expectedCloseDate: input.expectedCloseDate,
      notes: input.notes,
    };

    const updated = await db.opportunity.update({
      where: { id: opportunity.id },
      data,
    });

    await logAudit({
      action: "opportunity.update",
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

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireSalesWrite(request);
    const opportunity = await findActiveOpportunity(params.id);

    if (!canMutateOpportunity(user, opportunity.ownerUserId)) {
      return NextResponse.json({ error: "Forbidden: You do not have permission to delete this opportunity." }, { status: 403 });
    }

    await db.opportunity.update({
      where: { id: opportunity.id },
      data: { deletedAt: new Date() },
    });

    await logAudit({
      action: "opportunity.delete",
      entityType: "Opportunity",
      entityId: opportunity.id,
      actorUserId: user.id,
      before: opportunity,
      after: { deleted: true },
    });

    // 204 No Content
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
