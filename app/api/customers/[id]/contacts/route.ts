import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import {
  apiErrorResponse,
  notFound,
  readJsonObject,
  requireCustomerWrite,
} from "@/lib/core/api";
import { parseContactInput } from "@/lib/core/validators";
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

    const contacts = await db.contact.findMany({
      where: {
        customerId: params.id,
        deletedAt: null,
      },
      orderBy: [{ isPrimary: "desc" }, { displayName: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({ contacts });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const user = await requireCustomerWrite(request);
    await ensureCustomer(params.id);

    const input = parseContactInput(await readJsonObject(request));
    const contact = await db.$transaction(async (tx) => {
      if (input.isPrimary) {
        await tx.contact.updateMany({
          where: {
            customerId: params.id,
            deletedAt: null,
            isPrimary: true,
          },
          data: { isPrimary: false },
        });
      }

      return tx.contact.create({
        data: {
          ...input,
          customerId: params.id,
        },
      });
    });

    await logAudit({
      actorUserId: user.id,
      action: "contact.create",
      entityType: "Contact",
      entityId: contact.id,
      after: contact,
      request,
    });

    return NextResponse.json({ contact }, { status: 201 });
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
