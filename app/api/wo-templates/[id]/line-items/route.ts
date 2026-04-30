import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { apiErrorResponse, readJsonObject } from "@/lib/core/api";
import { db } from "@/lib/db";
import { parseTemplateLineInput } from "@/lib/shop/validators";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth(request);

    const template = await db.woTemplate.findUnique({
      where: { id: params.id, deletedAt: null },
    });

    if (!template) {
      return NextResponse.json({ error: "Work order template not found" }, { status: 404 });
    }

    const lineItems = await db.woTemplateLineItem.findMany({
      where: { templateId: params.id },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({ lineItems });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth(request);
    const input = await readJsonObject(request);
    const data = parseTemplateLineInput(input);

    const template = await db.woTemplate.findUnique({
      where: { id: params.id, deletedAt: null },
    });

    if (!template) {
      return NextResponse.json({ error: "Work order template not found" }, { status: 404 });
    }

    const lineItem = await db.woTemplateLineItem.create({
      data: {
        templateId: params.id,
        ...data,
      },
    });

    return NextResponse.json({ lineItem }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
