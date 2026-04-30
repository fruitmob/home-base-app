import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import {
  apiErrorResponse,
  conflict,
  hasField,
  readJsonObject,
  requireCustomerEntityWrite,
} from "@/lib/core/api";
import {
  parseVehicleInput,
  parseVehicleMileageInput,
  ValidationError,
} from "@/lib/core/validators";
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

    const vehicle = await findActiveVehicle(params.id);

    return NextResponse.json({ vehicle });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const user = await requireCustomerEntityWrite(request);
    const body = await readJsonObject(request);
    const before = await findActiveVehicle(params.id);

    if (hasField(body, "customerId") && body.customerId !== before.customerId) {
      throw new ValidationError(["customerId cannot be changed on this route."]);
    }

    const input = parseVehicleInput({ ...before, ...body });
    await ensureVinAvailable(input.normalizedVin, before.id);

    const shouldAppendMileage =
      hasField(body, "currentMileage") &&
      input.currentMileage != null &&
      input.currentMileage !== before.currentMileage;
    const mileageInput = shouldAppendMileage
      ? parseVehicleMileageInput({
        value: input.currentMileage,
        source: body.mileageSource ?? "vehicle.update",
        recordedAt: body.mileageRecordedAt,
        note: body.mileageNote,
      })
      : null;

    const result = await db.$transaction(async (tx) => {
      const mileageReading = mileageInput
        ? await tx.vehicleMileageReading.create({
          data: {
            ...mileageInput,
            vehicleId: before.id,
            recordedByUserId: user.id,
          },
        })
        : null;
      const vehicle = await tx.vehicle.update({
        where: { id: before.id },
        data: input,
        include: vehicleDetailInclude,
      });

      return { vehicle, mileageReading };
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

    if (result.mileageReading) {
      await logAudit({
        actorUserId: user.id,
        action: "vehicleMileage.create",
        entityType: "VehicleMileageReading",
        entityId: result.mileageReading.id,
        after: result.mileageReading,
        request,
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}

async function ensureVinAvailable(normalizedVin: string | null, currentVehicleId: string) {
  if (!normalizedVin) {
    return;
  }

  const existingVehicle = await db.vehicle.findFirst({
    where: {
      normalizedVin,
      id: { not: currentVehicleId },
    },
    select: { id: true },
  });

  if (existingVehicle) {
    conflict("A vehicle with that VIN already exists.");
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const user = await requireCustomerEntityWrite(request);
    const before = await findActiveVehicle(params.id);
    const vehicle = await db.vehicle.update({
      where: { id: before.id },
      data: { deletedAt: new Date() },
      include: vehicleDetailInclude,
    });

    await logAudit({
      actorUserId: user.id,
      action: "vehicle.delete",
      entityType: "Vehicle",
      entityId: vehicle.id,
      before,
      after: vehicle,
      request,
    });

    return NextResponse.json({ vehicle });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
