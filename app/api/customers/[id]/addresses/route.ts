import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import {
  apiErrorResponse,
  notFound,
  readJsonObject,
  requireCustomerWrite,
} from "@/lib/core/api";
import { parseAddressInput } from "@/lib/core/validators";
import { db } from "@/lib/db";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(request: Request, { params }: RouteContext) {
  try {
    await requireAuth(request);
    await ensureCustomer(params.id);

    const addresses = await db.address.findMany({
      where: {
        customerId: params.id,
        deletedAt: null,
      },
      orderBy: [{ isPrimary: "desc" }, { type: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({ addresses });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const user = await requireCustomerWrite(request);
    await ensureCustomer(params.id);

    const input = parseAddressInput(await readJsonObject(request));
    const address = await db.$transaction(async (tx) => {
      if (input.isPrimary) {
        await tx.address.updateMany({
          where: {
            customerId: params.id,
            type: input.type,
            deletedAt: null,
            isPrimary: true,
          },
          data: { isPrimary: false },
        });
      }

      return tx.address.create({
        data: {
          ...input,
          customerId: params.id,
        },
      });
    });

    await logAudit({
      actorUserId: user.id,
      action: "address.create",
      entityType: "Address",
      entityId: address.id,
      after: address,
      request,
    });

    return NextResponse.json({ address }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

async function ensureCustomer(id: string) {
  const customer = await db.customer.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });

  if (!customer) {
    notFound("Customer was not found.");
  }

  return customer;
}
