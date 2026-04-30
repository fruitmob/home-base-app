import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { apiErrorResponse, readJsonObject } from "@/lib/core/api";
import { db } from "@/lib/db";

import { InspectionStatus } from "@/generated/prisma/client";
import { readOptionalString, requireRecord, parseEnum } from "@/lib/core/validators";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth(request);

    const inspection = await db.arrivalInspection.findUnique({
      where: { id: params.id },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, companyName: true } },
        vehicle: { select: { id: true, make: true, model: true, year: true } },
        performedByUser: { select: { id: true, email: true } },
        items: {
          orderBy: { displayOrder: "asc" }
        }
      },
    });

    if (!inspection || inspection.deletedAt) {
      return NextResponse.json({ error: "Inspection not found" }, { status: 404 });
    }

    return NextResponse.json({ inspection });
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
    const existing = await db.arrivalInspection.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: "Inspection not found" }, { status: 404 });
    }

    const data: any /* eslint-disable-line @typescript-eslint/no-explicit-any */ = {};
    if ("notes" in record) data.notes = readOptionalString(record, "notes");
    if ("status" in record) {
      data.status = parseEnum(record.status, InspectionStatus, "status", existing.status);
      if (data.status === InspectionStatus.COMPLETE && existing.status !== InspectionStatus.COMPLETE) {
        data.performedAt = new Date();
      }
    }

    const inspection = await db.arrivalInspection.update({
      where: { id },
      data,
    });

    return NextResponse.json({ inspection });
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
    await db.arrivalInspection.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
