import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import {
  apiErrorResponse,
  readJsonObject,
  requireCustomerEntityWrite,
} from "@/lib/core/api";
import { parseVehicleNoteInput } from "@/lib/core/validators";
import { findActiveVehicle } from "@/lib/core/vehicles";
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

    const notes = await db.vehicleNote.findMany({
      where: { vehicleId: params.id },
      orderBy: [{ createdAt: "desc" }],
    });

    return NextResponse.json({ notes });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const user = await requireCustomerEntityWrite(request);
    await findActiveVehicle(params.id);

    const input = parseVehicleNoteInput(await readJsonObject(request));
    const note = await db.vehicleNote.create({
      data: {
        ...input,
        vehicleId: params.id,
        authorUserId: user.id,
      },
    });

    await logAudit({
      actorUserId: user.id,
      action: "vehicleNote.create",
      entityType: "VehicleNote",
      entityId: note.id,
      after: note,
      request,
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
