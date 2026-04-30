import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireAuth(request);

    const part = await db.part.findUnique({
      where: { id: params.id, deletedAt: null },
      include: {
        category: true,
        vendor: true,
        transactions: {
          orderBy: { occurredAt: "desc" },
          include: {
            createdByUser: true,
            vendor: true,
          },
        },
        reservations: {
          where: { status: "ACTIVE" },
          orderBy: { reservedAt: "desc" },
          include: {
            workOrder: true,
            reservedByUser: true,
          },
        },
      },
    });

    if (!part) {
      return NextResponse.json({ error: "Part not found" }, { status: 404 });
    }

    return NextResponse.json(part);
  } catch {
    return NextResponse.json({ error: "Failed to fetch part" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireAuth(request);

    const data = await request.json();

    const part = await db.part.update({
      where: { id: params.id },
      data: {
        name: data.name,
        sku: data.sku,
        description: data.description,
        categoryId: data.categoryId,
        vendorId: data.vendorId,
        active: data.active,
        manufacturer: data.manufacturer,
        manufacturerPartNumber: data.manufacturerPartNumber,
        binLocation: data.binLocation,
        unitOfMeasure: data.unitOfMeasure,
        unitCost: data.unitCost,
        reorderPoint: data.reorderPoint,
      },
    });

    return NextResponse.json(part);
  } catch (error: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: "Part not found" }, { status: 404 });
    }
    if (error.code === 'P2002') {
      return NextResponse.json({ error: "SKU already in use" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update part" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireAuth(request);

    await db.part.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: "Part not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to delete part" }, { status: 500 });
  }
}
