import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { apiErrorResponse, readJsonObject } from "@/lib/core/api";
import { db } from "@/lib/db";
import { parseArrivalInspectionInput } from "@/lib/shop/validators";

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const workOrderId = searchParams.get("workOrderId");
    const vehicleId = searchParams.get("vehicleId");
    
    // Build where clause
    const where: any /* eslint-disable-line @typescript-eslint/no-explicit-any */ = { deletedAt: null };
    if (workOrderId) where.workOrderId = workOrderId;
    if (vehicleId) where.vehicleId = vehicleId;

    const inspections = await db.arrivalInspection.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, companyName: true } },
        vehicle: { select: { id: true, make: true, model: true, year: true } },
        performedByUser: { select: { id: true, email: true } },
      },
      take: 50,
    });

    return NextResponse.json({ inspections });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const input = await readJsonObject(request);
    const data = parseArrivalInspectionInput(input);

    const inspection = await db.arrivalInspection.create({
      data: {
        customerId: data.customerId,
        vehicleId: data.vehicleId,
        workOrderId: data.workOrderId,
        type: data.type,
        notes: data.notes,
        performedByUserId: user.id, // Set performer as creator by default
      },
    });

    return NextResponse.json({ inspection }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
