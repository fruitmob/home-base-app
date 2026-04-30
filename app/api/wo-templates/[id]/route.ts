import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { apiErrorResponse, readJsonObject } from "@/lib/core/api";
import { db } from "@/lib/db";
import { readOptionalString, readRequiredString, readOptionalBoolean, requireRecord } from "@/lib/core/validators";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth(request);

    const template = await db.woTemplate.findUnique({
      where: { id: params.id, deletedAt: null },
      include: {
        lineItems: {
          orderBy: { displayOrder: "asc" },
        },
      },
    });

    if (!template) {
      return NextResponse.json({ error: "Work order template not found" }, { status: 404 });
    }

    return NextResponse.json({ template });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth(request);
    const input = await readJsonObject(request);
    
    const record = requireRecord(input);
    const template = await db.woTemplate.findUnique({
      where: { id: params.id, deletedAt: null },
    });

    if (!template) {
      return NextResponse.json({ error: "Work order template not found" }, { status: 404 });
    }

    const name = "name" in record ? readRequiredString(record, "name") : undefined;
    const description = "description" in record ? readOptionalString(record, "description") : undefined;
    const active = "active" in record ? readOptionalBoolean(record, "active", template.active) : undefined;

    const updated = await db.woTemplate.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(active !== undefined && { active }),
      },
    });

    return NextResponse.json({ template: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(
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

    await db.woTemplate.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
