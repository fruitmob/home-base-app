import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { apiErrorResponse, readJsonObject } from "@/lib/core/api";
import { db } from "@/lib/db";
import { readOptionalString, readRequiredString, requireRecord, parseEnum } from "@/lib/core/validators";
import { InspectionItemResult } from "@/generated/prisma/client";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth(request);
    const input = await readJsonObject(request);
    const record = requireRecord(input);

    const existing = await db.inspectionItem.findUnique({
      where: { id: params.id },
      include: { inspection: true },
    });

    if (!existing || existing.inspection.deletedAt) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const data: any /* eslint-disable-line @typescript-eslint/no-explicit-any */ = {};
    if ("label" in record) data.label = readRequiredString(record, "label");
    if ("category" in record) data.category = readOptionalString(record, "category");
    if ("result" in record) data.result = parseEnum(record.result, InspectionItemResult, "result", existing.result);
    if ("notes" in record) data.notes = readOptionalString(record, "notes");
    if ("displayOrder" in record) data.displayOrder = Number(record.displayOrder) || existing.displayOrder;

    const item = await db.inspectionItem.update({
      where: { id: params.id },
      data,
    });

    return NextResponse.json({ item });
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

    await db.inspectionItem.delete({
      where: { id: params.id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
