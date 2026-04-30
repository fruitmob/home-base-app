import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const lowStock = searchParams.get("lowStock") === "true";
    const search = searchParams.get("search");

    let where: any /* eslint-disable-line @typescript-eslint/no-explicit-any */ = { deletedAt: null };

    if (search) {
      where = {
        ...where,
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { sku: { contains: search, mode: "insensitive" } },
          { manufacturerPartNumber: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    let parts = await db.part.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        category: true,
        vendor: true,
      },
    });

    if (lowStock) {
      parts = parts.filter((part) => {
        const available = Number(part.quantityOnHand) - Number(part.quantityReserved);
        return available <= Number(part.reorderPoint);
      });
    }

    return NextResponse.json(parts);
  } catch {
    return NextResponse.json({ error: "Unauthorized or failed to fetch parts" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth(request);

    const data = await request.json();

    if (!data.name || !data.sku) {
      return NextResponse.json({ error: "Missing required fields (name, sku)" }, { status: 400 });
    }

    // Default 0 for new parts unless otherwise provided. Receive via transactions!
    const part = await db.part.create({
      data: {
        name: data.name,
        sku: data.sku,
        description: data.description,
        categoryId: data.categoryId,
        vendorId: data.vendorId,
        productId: data.productId, // Optional link
        manufacturer: data.manufacturer,
        manufacturerPartNumber: data.manufacturerPartNumber,
        binLocation: data.binLocation,
        unitOfMeasure: data.unitOfMeasure || "each",
        unitCost: data.unitCost || 0,
        reorderPoint: data.reorderPoint || 0,
      },
    });

    return NextResponse.json(part, { status: 201 });
  } catch (error: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: "A part with this SKU already exists." }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create part" }, { status: 500 });
  }
}
