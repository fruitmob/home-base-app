import { requireSalesWrite } from "@/lib/core/api";
import { NextResponse } from "next/server";
import { Prisma, OpportunityStage, Role } from "@/generated/prisma/client";
import { requireAuth } from "@/lib/auth";
import {
  apiErrorResponse,
  readJsonObject,
} from "@/lib/core/api";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { parseOpportunityInput } from "@/lib/sales/validators";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const stageQuery = searchParams.get("stage");
    const ownerUserId = searchParams.get("ownerUserId");
    const customerId = searchParams.get("customerId");

    const whereAnd: Prisma.OpportunityWhereInput[] = [{ deletedAt: null }];

    if (stageQuery) {
      whereAnd.push({ stage: stageQuery as OpportunityStage });
    }

    if (user.role === Role.SALES_REP) {
      if (ownerUserId === user.id) {
        whereAnd.push({ ownerUserId: user.id });
      } else if (ownerUserId === "unassigned") {
        whereAnd.push({ ownerUserId: null });
      } else if (ownerUserId) {
        return NextResponse.json([]);
      } else {
        whereAnd.push({ OR: [{ ownerUserId: user.id }, { ownerUserId: null }] });
      }
    } else if (ownerUserId === "unassigned") {
      whereAnd.push({ ownerUserId: null });
    } else if (ownerUserId) {
      whereAnd.push({ ownerUserId });
    }

    if (customerId) {
      whereAnd.push({ customerId });
    }

    const opportunities = await db.opportunity.findMany({
      where: { AND: whereAnd },
      orderBy: { createdAt: "desc" },
      include: {
        customer: {
          select: { id: true, displayName: true },
        },
        ownerUser: {
          select: { id: true, email: true },
        },
      },
    });

    return NextResponse.json(opportunities);
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireSalesWrite(request);
    const input = parseOpportunityInput(await readJsonObject(request));

    if (user.role === Role.SALES_REP && input.ownerUserId && input.ownerUserId !== user.id) {
      return NextResponse.json(
        { error: "Sales reps can only assign opportunities to themselves or leave them unassigned." },
        { status: 403 },
      );
    }

    const ownerUserId = user.role === Role.SALES_REP ? input.ownerUserId ?? user.id : input.ownerUserId;
    const closedAt =
      input.stage === OpportunityStage.WON || input.stage === OpportunityStage.LOST ? new Date() : null;

    const opportunity = await db.opportunity.create({
      data: {
        customerId: input.customerId,
        vehicleId: input.vehicleId,
        ownerUserId,
        name: input.name,
        stage: input.stage,
        amount: input.amount,
        probability: input.probability,
        expectedCloseDate: input.expectedCloseDate,
        notes: input.notes,
        closedAt,
      },
    });

    await logAudit({
      action: "opportunity.create",
      entityType: "Opportunity",
      entityId: opportunity.id,
      actorUserId: user.id,
      after: opportunity,
    });

    return NextResponse.json(opportunity, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
