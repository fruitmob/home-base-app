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
import { parseContactInput } from "@/lib/core/validators";
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
    const before = await findActiveContact(params.id);
    authorizeContactWrite(user, before);

    const input = parseContactInput({ ...before, ...body });
    const contact = await db.$transaction(async (tx) => {
      if (input.isPrimary) {
        if (before.customerId) {
          await tx.contact.updateMany({
            where: {
              customerId: before.customerId,
              id: { not: before.id },
              deletedAt: null,
              isPrimary: true,
            },
            data: { isPrimary: false },
          });
        } else if (before.vendorId) {
          await tx.contact.updateMany({
            where: {
              vendorId: before.vendorId,
              id: { not: before.id },
              deletedAt: null,
              isPrimary: true,
            },
            data: { isPrimary: false },
          });
        }
      }

      return tx.contact.update({
        where: { id: before.id },
        data: input,
      });
    });

    await logAudit({
      actorUserId: user.id,
      action: "contact.update",
      entityType: "Contact",
      entityId: contact.id,
      before,
      after: contact,
      request,
    });

    return NextResponse.json({ contact });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const user = await requireAuth(request);
    verifyMutationCsrf(request);

    const before = await findActiveContact(params.id);
    authorizeContactWrite(user, before);

    const contact = await db.contact.update({
      where: { id: before.id },
      data: { deletedAt: new Date() },
    });

    await logAudit({
      actorUserId: user.id,
      action: "contact.delete",
      entityType: "Contact",
      entityId: contact.id,
      before,
      after: contact,
      request,
    });

    return NextResponse.json({ contact });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

async function findActiveContact(id: string) {
  const contact = await db.contact.findFirst({
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

  if (!contact) {
    notFound("Contact was not found.");
  }

  return contact;
}

function authorizeContactWrite(
  user: CurrentUser,
  contact: { customerId: string | null; vendorId: string | null },
) {
  if (contact.customerId) {
    assertCustomerEntityWriteRole(user);
    return;
  }

  if (contact.vendorId) {
    assertVendorWriteRole(user);
    return;
  }

  notFound("Contact was not found.");
}
