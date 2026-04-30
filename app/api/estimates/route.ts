import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";
import { Prisma, EstimateStatus } from "@/generated/prisma/client";
import { requireAuth } from "@/lib/auth";
import { apiErrorResponse, readJsonObject } from "@/lib/core/api";
import { db } from "@/lib/db";
import { withEstimateNumberRetry } from "@/lib/shop/numbering";
import { parseEstimateInput } from "@/lib/shop/validators";

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim();
    const status = searchParams.get("status")?.trim().toUpperCase();
    const customerId = searchParams.get("customerId")?.trim();

    const where: Prisma.EstimateWhereInput = { deletedAt: null };

    if (status) {
      if (!Object.values(EstimateStatus).includes(status as EstimateStatus)) {
        return NextResponse.json({ error: "Invalid estimate status." }, { status: 400 });
      }
      where.status = status as EstimateStatus;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (query) {
      where.OR = [
        { estimateNumber: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { title: { contains: query, mode: Prisma.QueryMode.insensitive } },
      ];
    }

    const estimates = await db.estimate.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { firstName: true, lastName: true, displayName: true } },
        vehicle: { select: { make: true, model: true, year: true } },
      },
      take: 100, // Limit for listing
    });

    return NextResponse.json({ estimates });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const input = await readJsonObject(request);
    const data = parseEstimateInput(input);

    const estimate = await withEstimateNumberRetry(async (estimateNumber) => {
      return db.estimate.create({
        data: {
          estimateNumber,
          customerId: data.customerId,
          vehicleId: data.vehicleId,
          opportunityId: data.opportunityId,
          quoteId: data.quoteId,
          title: data.title,
          notes: data.notes,
          validUntil: data.validUntil,
          createdByUserId: user.id,
        },
      });
    });

    return NextResponse.json({ estimate }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
