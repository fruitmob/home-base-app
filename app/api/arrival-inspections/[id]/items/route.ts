import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { apiErrorResponse, readJsonObject } from "@/lib/core/api";
import { db } from "@/lib/db";
import { parseInspectionItemInput } from "@/lib/shop/validators";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth(request);

    const items = await db.inspectionItem.findMany({
      where: { inspectionId: params.id },
      orderBy: { displayOrder: "asc" },
    });

    return NextResponse.json({ items });
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

    // Support single object or array
    const inputs = Array.isArray(input) ? input : [input];

    const currentMax = await db.inspectionItem.aggregate({
      where: { inspectionId: params.id },
      _max: { displayOrder: true },
    });
    let nextOrder = (currentMax._max.displayOrder || 0) + 1;

    const data = inputs.map((item) => {
      const parsed = parseInspectionItemInput(item);
      return {
        inspectionId: params.id,
        label: parsed.label,
        category: parsed.category,
        result: parsed.result,
        notes: parsed.notes,
        displayOrder: nextOrder++,
      };
    });

    await db.inspectionItem.createMany({ data });

    const items = await db.inspectionItem.findMany({
      where: { inspectionId: params.id },
      orderBy: { displayOrder: "asc" },
    });

    return NextResponse.json({ items }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
