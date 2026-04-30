import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { apiErrorResponse, readJsonObject } from "@/lib/core/api";
import { db } from "@/lib/db";
import { parseWarrantyClaimInput } from "@/lib/shop/validators";

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const workOrderId = searchParams.get("workOrderId");
    const sourceWorkOrderId = searchParams.get("sourceWorkOrderId");
    
    // Build where clause
    const where: any /* eslint-disable-line @typescript-eslint/no-explicit-any */ = { deletedAt: null };
    if (workOrderId) where.workOrderId = workOrderId;
    if (sourceWorkOrderId) where.sourceWorkOrderId = sourceWorkOrderId;

    const claims = await db.warrantyClaim.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        vendor: { select: { id: true, name: true } },
        case: { select: { id: true, subject: true } },
      },
      take: 100,
    });

    return NextResponse.json({ claims });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);
    const input = await readJsonObject(request);
    const data = parseWarrantyClaimInput(input);

    const claim = await db.warrantyClaim.create({
      data: {
        workOrderId: data.workOrderId,
        sourceWorkOrderId: data.sourceWorkOrderId,
        vendorId: data.vendorId,
        caseId: data.caseId,
        title: data.title,
        description: data.description,
        claimNumber: data.claimNumber,
      },
    });

    return NextResponse.json({ claim }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
