import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import {
  apiErrorResponse,
  notFound,
  readJsonObject,
  requireWorkOrderWrite,
} from "@/lib/core/api";
import { db } from "@/lib/db";
import { parseBayInput } from "@/lib/shop/validators";

type RouteContext = { params: { id: string } };

export async function GET(request: Request, { params }: RouteContext) {
  try {
    await requireAuth(request);

    const bay = await db.bay.findUnique({
      where: { id: params.id, deletedAt: null },
    });

    if (!bay) {
      notFound("Bay not found.");
    }

    return NextResponse.json({ bay });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const user = await requireWorkOrderWrite(request);
    const input = parseBayInput(await readJsonObject(request));

    const existing = await db.bay.findUnique({
      where: { id: params.id, deletedAt: null },
    });

    if (!existing) {
      notFound("Bay not found.");
    }

    const bay = await db.bay.update({
      where: { id: params.id },
      data: {
        name: input.name,
        description: input.description,
        active: input.active,
        sortOrder: input.sortOrder,
      },
    });

    await logAudit({
      actorUserId: user.id,
      action: "bay.update",
      entityType: "Bay",
      entityId: bay.id,
      before: existing,
      after: bay,
      request,
    });

    return NextResponse.json({ bay });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const user = await requireWorkOrderWrite(request);

    const existing = await db.bay.findUnique({
      where: { id: params.id, deletedAt: null },
    });

    if (!existing) {
      notFound("Bay not found.");
    }

    const bay = await db.bay.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    });

    await logAudit({
      actorUserId: user.id,
      action: "bay.delete",
      entityType: "Bay",
      entityId: bay.id,
      before: existing,
      after: bay,
      request,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
