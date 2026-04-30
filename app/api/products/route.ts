import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import {
  apiErrorResponse,
  readJsonObject,
  requireCatalogWrite,
} from "@/lib/core/api";
import { parseProductInput } from "@/lib/sales/validators";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  try {
    await requireAuth(request);

    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim();
    const family = url.searchParams.get("family")?.trim();
    const activeParam = url.searchParams.get("active");
    const where: Prisma.ProductWhereInput = { deletedAt: null };

    if (query) {
      where.OR = [
        { sku: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { name: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { description: { contains: query, mode: Prisma.QueryMode.insensitive } },
      ];
    }

    if (family) {
      where.family = family;
    }

    if (activeParam === "true" || activeParam === "false") {
      where.active = activeParam === "true";
    }

    const products = await db.product.findMany({
      where,
      orderBy: [{ name: "asc" }, { createdAt: "desc" }],
      take: 200,
    });

    return NextResponse.json({ products });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireCatalogWrite(request);
    const input = parseProductInput(await readJsonObject(request));
    const product = await db.product.create({ data: input });

    await logAudit({
      actorUserId: user.id,
      action: "product.create",
      entityType: "Product",
      entityId: product.id,
      after: product,
      request,
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
