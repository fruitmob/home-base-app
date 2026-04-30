import { requireSalesWrite, apiErrorResponse, readJsonObject } from "@/lib/core/api";
import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { requireAuth, HttpError } from "@/lib/auth";
import { parseLeadInput } from "@/lib/sales/validators";
import { findActiveLead, canMutateLead } from "@/lib/sales/leads";
import { db } from "@/lib/db";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const user = await requireAuth(request);
    const lead = await findActiveLead(params.id);

    if (!canMutateLead(user, lead.ownerUserId)) {
      throw new HttpError(403, "You do not have permission to view this lead.");
    }

    return NextResponse.json({ lead });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const user = await requireSalesWrite(request);
    const before = await findActiveLead(params.id);

    if (!canMutateLead(user, before.ownerUserId)) {
      throw new HttpError(403, "You do not have permission to modify this lead.");
    }

    const body = await readJsonObject(request);
    const input = parseLeadInput({
      status: before.status,
      source: before.source,
      companyName: before.companyName,
      firstName: before.firstName,
      lastName: before.lastName,
      displayName: before.displayName,
      email: before.email,
      phone: before.phone,
      interest: before.interest,
      estimatedValue: before.estimatedValue ? Number(before.estimatedValue) : null,
      notes: before.notes,
      ownerUserId: before.ownerUserId,
      customerId: before.customerId,
      ...body,
    });

    if (user.role === "SALES_REP" && input.ownerUserId && input.ownerUserId !== user.id) {
      throw new HttpError(403, "Sales reps can only assign leads to themselves or leave them unassigned.");
    }

    const lead = await db.lead.update({
      where: { id: before.id },
      data: {
        status: input.status,
        source: input.source,
        companyName: input.companyName,
        firstName: input.firstName,
        lastName: input.lastName,
        displayName: input.displayName,
        email: input.email,
        phone: input.phone,
        interest: input.interest,
        estimatedValue: input.estimatedValue,
        notes: input.notes,
        ownerUserId: input.ownerUserId,
        customerId: input.customerId,
      },
      include: {
        ownerUser: { select: { id: true, email: true } },
      },
    });

    await logAudit({
      actorUserId: user.id,
      action: "lead.update",
      entityType: "Lead",
      entityId: lead.id,
      before,
      after: lead,
      request,
    });

    return NextResponse.json({ lead });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const user = await requireSalesWrite(request);
    const before = await findActiveLead(params.id);

    if (!canMutateLead(user, before.ownerUserId)) {
      throw new HttpError(403, "You do not have permission to modify this lead.");
    }

    const lead = await db.lead.update({
      where: { id: before.id },
      data: { deletedAt: new Date() },
    });

    await logAudit({
      actorUserId: user.id,
      action: "lead.delete",
      entityType: "Lead",
      entityId: lead.id,
      before,
      after: lead,
      request,
    });

    return NextResponse.json({ lead });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
