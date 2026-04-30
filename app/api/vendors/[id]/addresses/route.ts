import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import {
  apiErrorResponse,
  readJsonObject,
  requireVendorWrite,
} from "@/lib/core/api";
import { parseAddressInput } from "@/lib/core/validators";
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

    const addresses = await db.address.findMany({
      where: {
        vendorId: params.id,
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
    const user = await requireVendorWrite(request);
    await ensureActiveVendor(params.id);

    const input = parseAddressInput(await readJsonObject(request));
    const address = await db.$transaction(async (tx) => {
      if (input.isPrimary) {
        await tx.address.updateMany({
          where: {
            vendorId: params.id,
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
          vendorId: params.id,
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
