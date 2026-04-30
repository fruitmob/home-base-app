import { VehicleNoteType, type VehicleNoteType as VehicleNoteTypeValue } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";

export async function createVehicleNote({
  vehicleId,
  userId,
  body,
  type = "GENERAL",
  request,
}: {
  vehicleId: string;
  userId: string;
  body: string;
  type?: VehicleNoteTypeValue;
  request?: Request;
}) {
  const note = await db.vehicleNote.create({
    data: {
      vehicleId,
      authorUserId: userId,
      type: type ?? VehicleNoteType.GENERAL,
      body,
    },
  });

  await logAudit({
    actorUserId: userId,
    action: "vehicleNote.create",
    entityType: "VehicleNote",
    entityId: note.id,
    after: note,
    request,
  });

  return note;
}
