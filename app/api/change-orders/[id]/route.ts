import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { apiErrorResponse, readJsonObject } from "@/lib/core/api";
import { db } from "@/lib/db";
import { parseChangeOrderInput } from "@/lib/shop/validators";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth(request);

    const changeOrder = await db.changeOrder.findUnique({
      where: { id: params.id, deletedAt: null },
      include: {
        requestedByUser: { select: { email: true } },
      },
    });

    if (!changeOrder) {
      return NextResponse.json({ error: "Change order not found" }, { status: 404 });
    }

    return NextResponse.json({ changeOrder });
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
    const data = parseChangeOrderInput(input);

    const changeOrder = await db.changeOrder.findUnique({
      where: { id: params.id, deletedAt: null },
    });

    if (!changeOrder) {
      return NextResponse.json({ error: "Change order not found" }, { status: 404 });
    }

    if (changeOrder.status !== "DRAFT") {
      return NextResponse.json({ error: "Only draft change orders can be edited." }, { status: 400 });
    }

    const updated = await db.changeOrder.update({
      where: { id: params.id },
      data: {
        title: data.title,
        reason: data.reason,
      },
    });

    return NextResponse.json({ changeOrder: updated });
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

    const changeOrder = await db.changeOrder.findUnique({
      where: { id: params.id, deletedAt: null },
    });

    if (!changeOrder) {
      return NextResponse.json({ error: "Change order not found" }, { status: 404 });
    }

    if (changeOrder.status !== "DRAFT") {
      return NextResponse.json({ error: "Only draft change orders can be deleted." }, { status: 400 });
    }

    await db.changeOrder.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
