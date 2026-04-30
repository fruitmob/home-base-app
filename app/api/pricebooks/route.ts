import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import {
  apiErrorResponse,
  readJsonObject,
  requireCatalogWrite,
} from "@/lib/core/api";
import { parsePricebookInput } from "@/lib/sales/validators";
import { pricebookDetailInclude } from "@/lib/sales/catalog";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  try {
    await requireAuth(request);

    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim();
    const activeParam = url.searchParams.get("active");
    const where: Prisma.PricebookWhereInput = { deletedAt: null };

    if (query) {
      where.OR = [
        { name: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { description: { contains: query, mode: Prisma.QueryMode.insensitive } },
      ];
    }

    if (activeParam === "true" || activeParam === "false") {
      where.active = activeParam === "true";
    }

    const pricebooks = await db.pricebook.findMany({
      where,
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      take: 100,
    });

    return NextResponse.json({ pricebooks });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireCatalogWrite(request);
    const input = parsePricebookInput(await readJsonObject(request));

    const pricebook = await db.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.pricebook.updateMany({
          where: { isDefault: true, deletedAt: null },
          data: { isDefault: false },
        });
      }

      return tx.pricebook.create({
        data: input,
        include: pricebookDetailInclude,
      });
    });

    await logAudit({
      actorUserId: user.id,
      action: "pricebook.create",
      entityType: "Pricebook",
      entityId: pricebook.id,
      after: pricebook,
      request,
    });

    return NextResponse.json({ pricebook }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
