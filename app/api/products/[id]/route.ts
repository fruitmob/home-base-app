import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import {
  apiErrorResponse,
  readJsonObject,
  requireCatalogWrite,
} from "@/lib/core/api";
import { parseProductInput } from "@/lib/sales/validators";
import { findActiveProduct } from "@/lib/sales/catalog";
import { db } from "@/lib/db";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(request: Request, { params }: RouteContext) {
  try {
    await requireAuth(request);

    const product = await findActiveProduct(params.id);

    return NextResponse.json({ product });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const user = await requireCatalogWrite(request);
    const body = await readJsonObject(request);
    const before = await findActiveProduct(params.id);
    const input = parseProductInput({ ...before, ...body });
    const product = await db.product.update({
      where: { id: before.id },
      data: input,
    });

    await logAudit({
      actorUserId: user.id,
      action: "product.update",
      entityType: "Product",
      entityId: product.id,
      before,
      after: product,
      request,
    });

    return NextResponse.json({ product });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const user = await requireCatalogWrite(request);
    const before = await findActiveProduct(params.id);
    const product = await db.product.update({
      where: { id: before.id },
      data: { deletedAt: new Date() },
    });

    await logAudit({
      actorUserId: user.id,
      action: "product.delete",
      entityType: "Product",
      entityId: product.id,
      before,
      after: product,
      request,
    });

    return NextResponse.json({ product });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
