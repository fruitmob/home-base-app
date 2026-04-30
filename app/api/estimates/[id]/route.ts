import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { apiErrorResponse, readJsonObject } from "@/lib/core/api";
import { db } from "@/lib/db";
import { parseEstimateInput } from "@/lib/shop/validators";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth(request);

    const estimate = await db.estimate.findUnique({
      where: { id: params.id, deletedAt: null },
      include: {
        customer: true,
        vehicle: true,
        createdByUser: { select: { email: true } },
      },
    });

    if (!estimate) {
      return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
    }

    return NextResponse.json({ estimate });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth(request);
    const input = await readJsonObject(request);
    const data = parseEstimateInput(input);

    const estimate = await db.estimate.findUnique({
      where: { id: params.id, deletedAt: null },
    });

    if (!estimate) {
      return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
    }

    if (estimate.status !== "DRAFT") {
      return NextResponse.json({ error: "Only draft estimates can be edited." }, { status: 400 });
    }

    const updated = await db.estimate.update({
      where: { id: params.id },
      data: {
        customerId: data.customerId,
        vehicleId: data.vehicleId,
        opportunityId: data.opportunityId,
        quoteId: data.quoteId,
        title: data.title,
        notes: data.notes,
        validUntil: data.validUntil,
      },
    });

    return NextResponse.json({ estimate: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth(request);

    const estimate = await db.estimate.findUnique({
      where: { id: params.id, deletedAt: null },
    });

    if (!estimate) {
      return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
    }

    if (estimate.status !== "DRAFT") {
      return NextResponse.json({ error: "Only draft estimates can be deleted." }, { status: 400 });
    }

    await db.estimate.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
