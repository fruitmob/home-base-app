import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import {
  apiErrorResponse,
  readJsonObject,
  requireVendorWrite,
} from "@/lib/core/api";
import { parseVendorInput } from "@/lib/core/validators";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  try {
    await requireAuth(request);

    const query = new URL(request.url).searchParams.get("q")?.trim();
    const where: Prisma.VendorWhereInput = { deletedAt: null };

    if (query) {
      where.OR = [
        { name: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { accountNumber: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { email: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { phone: { contains: query, mode: Prisma.QueryMode.insensitive } },
      ];
    }

    const vendors = await db.vendor.findMany({
      where,
      orderBy: [{ name: "asc" }, { createdAt: "desc" }],
      take: 100,
    });

    return NextResponse.json({ vendors });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireVendorWrite(request);
    const input = parseVendorInput(await readJsonObject(request));
    const vendor = await db.vendor.create({ data: input });

    await logAudit({
      actorUserId: user.id,
      action: "vendor.create",
      entityType: "Vendor",
      entityId: vendor.id,
      after: vendor,
      request,
    });

    return NextResponse.json({ vendor }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
