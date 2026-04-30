import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import {
  apiErrorResponse,
  readJsonObject,
  requireWorkOrderWrite,
} from "@/lib/core/api";
import { db } from "@/lib/db";
import { parseBayInput } from "@/lib/shop/validators";

export async function GET(request: Request) {
  try {
    await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const active = searchParams.get("active")?.trim();

    const where: Prisma.BayWhereInput = { deletedAt: null };

    if (active === "true") {
      where.active = true;
    } else if (active === "false") {
      where.active = false;
    }

    const bays = await db.bay.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ bays });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireWorkOrderWrite(request);
    const input = parseBayInput(await readJsonObject(request));

    const bay = await db.bay.create({
      data: {
        name: input.name,
        description: input.description,
        active: input.active,
        sortOrder: input.sortOrder,
      },
    });

    await logAudit({
      actorUserId: user.id,
      action: "bay.create",
      entityType: "Bay",
      entityId: bay.id,
      after: bay,
      request,
    });

    return NextResponse.json({ bay }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
