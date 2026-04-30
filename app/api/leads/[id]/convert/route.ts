import { requireSalesWrite, readJsonObject, apiErrorResponse } from "@/lib/core/api";
import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { HttpError } from "@/lib/auth";
import { parseLeadConvertInput } from "@/lib/sales/validators";
import { findActiveLead, canMutateLead } from "@/lib/sales/leads";
import { db } from "@/lib/db";
import { CustomerType, LeadStatus } from "@/generated/prisma/client";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const user = await requireSalesWrite(request);
    const before = await findActiveLead(params.id);

    if (!canMutateLead(user, before.ownerUserId)) {
      throw new HttpError(403, "You do not have permission to modify this lead.");
    }

    if (before.status === LeadStatus.CONVERTED) {
      if (!before.convertedOpportunityId) {
        throw new HttpError(409, "Converted lead is missing its opportunity reference.");
      }

      const opportunity = await db.opportunity.findFirst({
        where: { id: before.convertedOpportunityId, deletedAt: null },
      });

      if (!opportunity) {
        throw new HttpError(409, "Converted opportunity was not found.");
      }

      return NextResponse.json({ lead: before, opportunity });
    }

    if (before.status === LeadStatus.UNQUALIFIED) {
      throw new HttpError(400, "Cannot convert an unqualified lead.");
    }

    const input = parseLeadConvertInput(await readJsonObject(request));

    const result = await db.$transaction(async (tx) => {
      // 1. Resolve Customer
      let finalCustomerId: string;
      if (input.createCustomer) {
        if (input.customerId) {
          throw new HttpError(400, "Cannot both create a new customer and specify an existing customer ID.");
        }
        const cust = await tx.customer.create({
          data: {
            customerType: before.companyName ? CustomerType.BUSINESS : CustomerType.INDIVIDUAL,
            displayName: before.displayName,
            companyName: before.companyName,
            firstName: before.firstName,
            lastName: before.lastName,
            email: before.email,
            phone: before.phone,
            notes: `Converted from lead. Original notes: ${before.notes || "None"}`,
          },
        });
        finalCustomerId = cust.id;
      } else {
        const id = input.customerId || before.customerId;
        if (!id) {
          throw new HttpError(400, "You must select an existing customer or choose to create a new one.");
        }
        const cust = await tx.customer.findFirst({ where: { id, deletedAt: null } });
        if (!cust) {
          throw new HttpError(404, "Selected customer was not found.");
        }
        finalCustomerId = cust.id;
      }

      // 2. Create Opportunity
      const opp = await tx.opportunity.create({
        data: {
          customerId: finalCustomerId,
          ownerUserId: input.opportunityOwnerUserId || before.ownerUserId,
          name: input.opportunityName,
          stage: input.opportunityStage,
          amount: input.opportunityAmount,
          expectedCloseDate: input.opportunityExpectedCloseDate,
          notes: input.opportunityNotes,
        },
      });

      // 3. Update Lead
      const updatedLead = await tx.lead.update({
        where: { id: before.id },
        data: {
          status: LeadStatus.CONVERTED,
          convertedCustomerId: finalCustomerId,
          convertedOpportunityId: opp.id,
          convertedAt: new Date(),
        },
      });

      return { lead: updatedLead, opportunity: opp };
    });

    await logAudit({
      actorUserId: user.id,
      action: "lead.convert",
      entityType: "Lead",
      entityId: result.lead.id,
      before,
      after: result.lead,
      request,
    });

    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
