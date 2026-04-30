import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import {
  apiErrorResponse,
  notFound,
  readJsonObject,
  requireCustomerWrite,
} from "@/lib/core/api";
import { parseCustomerInput } from "@/lib/core/validators";
import { db } from "@/lib/db";

const customerDetailInclude: Prisma.CustomerInclude = {
  contacts: {
    where: { deletedAt: null },
    orderBy: [{ isPrimary: "desc" }, { displayName: "asc" }, { createdAt: "asc" }],
  },
  addresses: {
    where: { deletedAt: null },
    orderBy: [{ isPrimary: "desc" }, { type: "asc" }, { createdAt: "asc" }],
  },
};

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(request: Request, { params }: RouteContext) {
  try {
    await requireAuth(request);

    const customer = await findCustomer(params.id);

    return NextResponse.json({ customer });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const user = await requireCustomerWrite(request);
    const body = await readJsonObject(request);
    const before = await findCustomer(params.id);
    const input = parseCustomerInput({ ...before, ...body });
    const customer = await db.customer.update({
      where: { id: before.id },
      data: input,
      include: customerDetailInclude,
    });

    await logAudit({
      actorUserId: user.id,
      action: "customer.update",
      entityType: "Customer",
      entityId: customer.id,
      before,
      after: customer,
      request,
    });

    return NextResponse.json({ customer });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const user = await requireCustomerWrite(request);
    const before = await findCustomer(params.id);
    const customer = await db.customer.update({
      where: { id: before.id },
      data: { deletedAt: new Date() },
      include: customerDetailInclude,
    });

    await logAudit({
      actorUserId: user.id,
      action: "customer.delete",
      entityType: "Customer",
      entityId: customer.id,
      before,
      after: customer,
      request,
    });

    return NextResponse.json({ customer });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

async function findCustomer(id: string) {
  const customer = await db.customer.findFirst({
    where: { id, deletedAt: null },
    include: customerDetailInclude,
  });

  if (!customer) {
    notFound("Customer was not found.");
  }

  return customer;
}
