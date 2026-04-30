import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { apiErrorResponse, readJsonObject } from "@/lib/core/api";
import { db } from "@/lib/db";
import { WarrantyClaimStatus } from "@/generated/prisma/client";
import { readOptionalString, readOptionalDecimal, parseEnum, requireRecord } from "@/lib/core/validators";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth(request);

    const claim = await db.warrantyClaim.findUnique({
      where: { id: params.id },
      include: {
        vendor: { select: { id: true, name: true } },
        case: { select: { id: true, subject: true } },
        workOrder: { select: { id: true, workOrderNumber: true } },
        sourceWorkOrder: { select: { id: true, workOrderNumber: true } },
      },
    });

    if (!claim || claim.deletedAt) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    return NextResponse.json({ claim });
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
    const id = params.id;

    // Can only edit if not deleted
    const existing = await db.warrantyClaim.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    const data: any /* eslint-disable-line @typescript-eslint/no-explicit-any */ = {};
    if ("title" in record) data.title = readOptionalString(record, "title");
    if ("description" in record) data.description = readOptionalString(record, "description");
    if ("claimNumber" in record) data.claimNumber = readOptionalString(record, "claimNumber");
    if ("recoveryAmount" in record) data.recoveryAmount = readOptionalDecimal(record, "recoveryAmount");
    
    if ("status" in record) {
      data.status = parseEnum(record.status, WarrantyClaimStatus, "status", existing.status);
      
      // Auto-set dates based on terminal states
      if (data.status === WarrantyClaimStatus.SUBMITTED && !existing.submittedAt) {
        data.submittedAt = new Date();
      }
      
      if ((data.status === WarrantyClaimStatus.RECOVERED || data.status === WarrantyClaimStatus.DENIED) 
          && existing.status !== WarrantyClaimStatus.RECOVERED 
          && existing.status !== WarrantyClaimStatus.DENIED) {
        data.resolvedAt = new Date();
      }
    }

    const claim = await db.warrantyClaim.update({
      where: { id },
      data,
    });

    return NextResponse.json({ claim });
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

    // Soft delete
    await db.warrantyClaim.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
