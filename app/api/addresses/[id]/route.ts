import { NextResponse } from "next/server";
import { requireAuth, type CurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  assertCustomerEntityWriteRole,
  assertVendorWriteRole,
  apiErrorResponse,
  notFound,
  readJsonObject,
  verifyMutationCsrf,
} from "@/lib/core/api";
import { parseAddressInput } from "@/lib/core/validators";
import { db } from "@/lib/db";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const user = await requireAuth(request);
    verifyMutationCsrf(request);

    const body = await readJsonObject(request);
    const before = await findActiveAddress(params.id);
    authorizeAddressWrite(user, before);

    const input = parseAddressInput({ ...before, ...body });
    const address = await db.$transaction(async (tx) => {
      if (input.isPrimary) {
        if (before.customerId) {
          await tx.address.updateMany({
            where: {
              customerId: before.customerId,
              id: { not: before.id },
              type: input.type,
              deletedAt: null,
              isPrimary: true,
            },
            data: { isPrimary: false },
          });
        } else if (before.vendorId) {
          await tx.address.updateMany({
            where: {
              vendorId: before.vendorId,
              id: { not: before.id },
              type: input.type,
              deletedAt: null,
              isPrimary: true,
            },
            data: { isPrimary: false },
          });
        }
      }

      return tx.address.update({
        where: { id: before.id },
        data: input,
      });
    });

    await logAudit({
      actorUserId: user.id,
      action: "address.update",
      entityType: "Address",
      entityId: address.id,
      before,
      after: address,
      request,
    });

    return NextResponse.json({ address });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const user = await requireAuth(request);
    verifyMutationCsrf(request);

    const before = await findActiveAddress(params.id);
    authorizeAddressWrite(user, before);

    const address = await db.address.update({
      where: { id: before.id },
      data: { deletedAt: new Date() },
    });

    await logAudit({
      actorUserId: user.id,
      action: "address.delete",
      entityType: "Address",
      entityId: address.id,
      before,
      after: address,
      request,
    });

    return NextResponse.json({ address });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

async function findActiveAddress(id: string) {
  const address = await db.address.findFirst({
    where: {
      id,
      deletedAt: null,
      OR: [
        {
          customerId: { not: null },
          vendorId: null,
          customer: { is: { deletedAt: null } },
        },
        {
          vendorId: { not: null },
          customerId: null,
          vendor: { is: { deletedAt: null } },
        },
      ],
    },
  });

  if (!address) {
    notFound("Address was not found.");
  }

  return address;
}

function authorizeAddressWrite(
  user: CurrentUser,
  address: { customerId: string | null; vendorId: string | null },
) {
  if (address.customerId) {
    assertCustomerEntityWriteRole(user);
    return;
  }

  if (address.vendorId) {
    assertVendorWriteRole(user);
    return;
  }

  notFound("Address was not found.");
}
