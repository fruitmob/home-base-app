import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { requireAuth } from "@/lib/auth";
import { apiErrorResponse, readJsonObject } from "@/lib/core/api";
import { db } from "@/lib/db";
import { readRequiredString, readOptionalString } from "@/lib/core/validators";

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim();

    const where: Prisma.WoTemplateWhereInput = { deletedAt: null, active: true };

    if (query) {
      where.name = { contains: query, mode: Prisma.QueryMode.insensitive };
    }

    const templates = await db.woTemplate.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        _count: { select: { lineItems: true } },
      },
    });

    return NextResponse.json({ templates });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);
    const input = await readJsonObject(request);
    
    // We only need basic parsing for the template root
    const record = input as Record<string, unknown>;
    const name = readRequiredString(record, "name");
    const description = readOptionalString(record, "description");

    const template = await db.woTemplate.create({
      data: {
        name,
        description,
      },
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
