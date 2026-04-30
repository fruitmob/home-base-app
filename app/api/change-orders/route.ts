import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { requireAuth } from "@/lib/auth";
import { apiErrorResponse, readJsonObject } from "@/lib/core/api";
import { db } from "@/lib/db";
import { withChangeOrderNumberRetry } from "@/lib/shop/numbering";
import { parseChangeOrderInput } from "@/lib/shop/validators";
import { findActiveWorkOrder } from "@/lib/shop/workOrders";

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const workOrderId = searchParams.get("workOrderId")?.trim();

    const where: Prisma.ChangeOrderWhereInput = { deletedAt: null };

    if (workOrderId) {
      where.workOrderId = workOrderId;
    }

    const changeOrders = await db.changeOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        requestedByUser: { select: { email: true } },
      },
      take: 50,
    });

    return NextResponse.json({ changeOrders });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const input = await readJsonObject(request);
    const data = parseChangeOrderInput(input);

    const workOrder = await findActiveWorkOrder(data.workOrderId);

    // Make sure we have rights on the parent work order
    // (though requireAuth might just be a standard user check, if you need deeper auth, add it here)

    const changeOrder = await withChangeOrderNumberRetry(async (changeOrderNumber) => {
      return db.changeOrder.create({
        data: {
          changeOrderNumber,
          workOrderId: workOrder.id,
          title: data.title,
          reason: data.reason,
          requestedByUserId: user.id,
        },
      });
    });

    return NextResponse.json({ changeOrder }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
