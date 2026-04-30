import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import {
  apiErrorResponse,
  readJsonObject,
  requireCustomerEntityWrite,
} from "@/lib/core/api";
import { parseVehicleMileageInput } from "@/lib/core/validators";
import { findActiveVehicle, vehicleDetailInclude } from "@/lib/core/vehicles";
import { db } from "@/lib/db";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(request: Request, { params }: RouteContext) {
  try {
    await requireAuth(request);
    await findActiveVehicle(params.id);

    const mileageReadings = await db.vehicleMileageReading.findMany({
      where: { vehicleId: params.id },
      orderBy: [{ recordedAt: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ mileageReadings });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const user = await requireCustomerEntityWrite(request);
    const before = await findActiveVehicle(params.id);
    const input = parseVehicleMileageInput(await readJsonObject(request));
    const result = await db.$transaction(async (tx) => {
      const mileageReading = await tx.vehicleMileageReading.create({
        data: {
          ...input,
          vehicleId: before.id,
          recordedByUserId: user.id,
        },
      });
      const vehicle = await tx.vehicle.update({
        where: { id: before.id },
        data: { currentMileage: input.value },
        include: vehicleDetailInclude,
      });

      return { mileageReading, vehicle };
    });

    await logAudit({
      actorUserId: user.id,
      action: "vehicleMileage.create",
      entityType: "VehicleMileageReading",
      entityId: result.mileageReading.id,
      after: result.mileageReading,
      request,
    });
    await logAudit({
      actorUserId: user.id,
      action: "vehicle.update",
      entityType: "Vehicle",
      entityId: result.vehicle.id,
      before,
      after: result.vehicle,
      request,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
