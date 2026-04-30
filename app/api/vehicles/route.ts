import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import {
  apiErrorResponse,
  conflict,
  readJsonObject,
  readRequiredStringField,
  requireCustomerEntityWrite,
} from "@/lib/core/api";
import { parseVehicleInput, parseVehicleMileageInput } from "@/lib/core/validators";
import { ensureActiveCustomer, vehicleDetailInclude } from "@/lib/core/vehicles";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  try {
    await requireAuth(request);

    const searchParams = new URL(request.url).searchParams;
    const query = searchParams.get("q")?.trim();
    const customerId = searchParams.get("customerId")?.trim();
    const where: Prisma.VehicleWhereInput = {
      deletedAt: null,
      customer: {
        deletedAt: null,
      },
    };

    if (customerId) {
      where.customerId = customerId;
    }

    if (query) {
      where.OR = [
        { vin: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { normalizedVin: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { make: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { model: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { unitNumber: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { licensePlate: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { customer: { displayName: { contains: query, mode: Prisma.QueryMode.insensitive } } },
      ];
    }

    const vehicles = await db.vehicle.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 100,
    });

    return NextResponse.json({ vehicles });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireCustomerEntityWrite(request);
    const body = await readJsonObject(request);
    const customerId = readRequiredStringField(body, "customerId");

    await ensureActiveCustomer(customerId);

    const input = parseVehicleInput(body);
    await ensureVinAvailable(input.normalizedVin);

    const mileageInput = input.currentMileage == null
      ? null
      : parseVehicleMileageInput({
        value: input.currentMileage,
        source: body.mileageSource ?? "vehicle.create",
        recordedAt: body.mileageRecordedAt,
        note: body.mileageNote,
      });

    const result = await db.$transaction(async (tx) => {
      const vehicle = await tx.vehicle.create({
        data: {
          ...input,
          customerId,
        },
        include: vehicleDetailInclude,
      });
      const mileageReading = mileageInput
        ? await tx.vehicleMileageReading.create({
          data: {
            ...mileageInput,
            vehicleId: vehicle.id,
            recordedByUserId: user.id,
          },
        })
        : null;

      return { vehicle, mileageReading };
    });

    await logAudit({
      actorUserId: user.id,
      action: "vehicle.create",
      entityType: "Vehicle",
      entityId: result.vehicle.id,
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

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

async function ensureVinAvailable(normalizedVin: string | null) {
  if (!normalizedVin) {
    return;
  }

  const existingVehicle = await db.vehicle.findFirst({
    where: { normalizedVin },
    select: { id: true },
  });

  if (existingVehicle) {
    conflict("A vehicle with that VIN already exists.");
  }
}
