import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import {
  apiErrorResponse,
  readJsonObject,
  requireVendorWrite,
} from "@/lib/core/api";
import { parseContactInput } from "@/lib/core/validators";
import { ensureActiveVendor } from "@/lib/core/vendors";
import { db } from "@/lib/db";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(request: Request, { params }: RouteContext) {
  try {
    await requireAuth(request);
    await ensureActiveVendor(params.id);

    const contacts = await db.contact.findMany({
      where: {
        vendorId: params.id,
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
    const user = await requireVendorWrite(request);
    await ensureActiveVendor(params.id);

    const input = parseContactInput(await readJsonObject(request));
    const contact = await db.$transaction(async (tx) => {
      if (input.isPrimary) {
        await tx.contact.updateMany({
          where: {
            vendorId: params.id,
            deletedAt: null,
            isPrimary: true,
          },
          data: { isPrimary: false },
        });
      }

      return tx.contact.create({
        data: {
          ...input,
          vendorId: params.id,
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
