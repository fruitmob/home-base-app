import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import {
  apiErrorResponse,
  conflict,
  readJsonObject,
  requireCatalogWrite,
} from "@/lib/core/api";
import { parsePricebookEntryInput } from "@/lib/sales/validators";
import { ensureActivePricebook, ensureActiveProduct } from "@/lib/sales/catalog";
import { db } from "@/lib/db";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(request: Request, { params }: RouteContext) {
  try {
    await requireAuth(request);

    await ensureActivePricebook(params.id);

    const entries = await db.pricebookEntry.findMany({
      where: { pricebookId: params.id, deletedAt: null },
      include: {
        product: { select: { id: true, sku: true, name: true, active: true } },
      },
      orderBy: [{ createdAt: "asc" }],
    });

    return NextResponse.json({ entries });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const user = await requireCatalogWrite(request);
    const pricebook = await ensureActivePricebook(params.id);
    const input = parsePricebookEntryInput(await readJsonObject(request));

    await ensureActiveProduct(input.productId);

    const existing = await db.pricebookEntry.findFirst({
      where: {
        pricebookId: pricebook.id,
        productId: input.productId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (existing) {
      conflict("That product already has an entry in this pricebook. Update the existing entry instead.");
    }

    const entry = await db.pricebookEntry.create({
      data: {
        pricebookId: pricebook.id,
        productId: input.productId,
        unitPrice: input.unitPrice,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo,
      },
      include: {
        product: { select: { id: true, sku: true, name: true } },
      },
    });

    await logAudit({
      actorUserId: user.id,
      action: "pricebook_entry.create",
      entityType: "PricebookEntry",
      entityId: entry.id,
      after: entry,
      request,
    });

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
