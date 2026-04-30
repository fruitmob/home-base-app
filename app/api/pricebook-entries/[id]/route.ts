import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import {
  apiErrorResponse,
  readJsonObject,
  requireCatalogWrite,
} from "@/lib/core/api";
import { parsePricebookEntryInput } from "@/lib/sales/validators";
import { findActivePricebookEntry } from "@/lib/sales/catalog";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(request: Request, { params }: RouteContext) {
  try {
    await requireAuth(request);

    const entry = await findActivePricebookEntry(params.id);

    return NextResponse.json({ entry });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const user = await requireCatalogWrite(request);
    const before = await findActivePricebookEntry(params.id);
    const body = await readJsonObject(request);
    const input = parsePricebookEntryInput({
      productId: before.productId,
      unitPrice: Number(before.unitPrice),
      effectiveFrom: before.effectiveFrom?.toISOString() ?? null,
      effectiveTo: before.effectiveTo?.toISOString() ?? null,
      ...body,
    });

    const entry = await db.pricebookEntry.update({
      where: { id: before.id },
      data: {
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
      action: "pricebook_entry.update",
      entityType: "PricebookEntry",
      entityId: entry.id,
      before,
      after: entry,
      request,
    });

    return NextResponse.json({ entry });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const user = await requireCatalogWrite(request);
    const before = await findActivePricebookEntry(params.id);
    const entry = await db.pricebookEntry.update({
      where: { id: before.id },
      data: { deletedAt: new Date() },
      include: {
        product: { select: { id: true, sku: true, name: true } },
      },
    });

    await logAudit({
      actorUserId: user.id,
      action: "pricebook_entry.delete",
      entityType: "PricebookEntry",
      entityId: entry.id,
      before,
      after: entry,
      request,
    });

    return NextResponse.json({ entry });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
