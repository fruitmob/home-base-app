import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  apiErrorResponse,
  readJsonObject,
  requireCustomerWrite,
} from "@/lib/core/api";
import { parseCustomerInput } from "@/lib/core/validators";

export async function GET(request: Request) {
  try {
    await requireAuth(request);

    const query = new URL(request.url).searchParams.get("q")?.trim();
    const where: Prisma.CustomerWhereInput = { deletedAt: null };

    if (query) {
      where.OR = [
        { displayName: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { companyName: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { firstName: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { lastName: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { email: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { phone: { contains: query, mode: Prisma.QueryMode.insensitive } },
      ];
    }

    const customers = await db.customer.findMany({
      where,
      orderBy: [{ displayName: "asc" }, { createdAt: "desc" }],
      take: 100,
    });

    return NextResponse.json({ customers });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireCustomerWrite(request);
    const input = parseCustomerInput(await readJsonObject(request));
    const customer = await db.customer.create({ data: input });

    await logAudit({
      actorUserId: user.id,
      action: "customer.create",
      entityType: "Customer",
      entityId: customer.id,
      after: customer,
      request,
    });

    return NextResponse.json({ customer }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
