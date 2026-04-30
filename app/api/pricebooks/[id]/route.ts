import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import {
  apiErrorResponse,
  conflict,
  readJsonObject,
  requireCatalogWrite,
} from "@/lib/core/api";
import { parsePricebookInput } from "@/lib/sales/validators";
import { findActivePricebook, pricebookDetailInclude } from "@/lib/sales/catalog";
import { db } from "@/lib/db";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(request: Request, { params }: RouteContext) {
  try {
    await requireAuth(request);

    const pricebook = await findActivePricebook(params.id);

    return NextResponse.json({ pricebook });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const user = await requireCatalogWrite(request);
    const body = await readJsonObject(request);
    const before = await findActivePricebook(params.id);
    const input = parsePricebookInput({ ...before, ...body });

    const pricebook = await db.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.pricebook.updateMany({
          where: {
            isDefault: true,
            deletedAt: null,
            NOT: { id: before.id },
          },
          data: { isDefault: false },
        });
      }

      return tx.pricebook.update({
        where: { id: before.id },
        data: input,
        include: pricebookDetailInclude,
      });
    });

    await logAudit({
      actorUserId: user.id,
      action: "pricebook.update",
      entityType: "Pricebook",
      entityId: pricebook.id,
      before,
      after: pricebook,
      request,
    });

    return NextResponse.json({ pricebook });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const user = await requireCatalogWrite(request);
    const before = await findActivePricebook(params.id);

    if (before.isDefault) {
      conflict("Cannot delete the default pricebook. Mark another pricebook as default first.");
    }

    const pricebook = await db.pricebook.update({
      where: { id: before.id },
      data: { deletedAt: new Date() },
      include: pricebookDetailInclude,
    });

    await logAudit({
      actorUserId: user.id,
      action: "pricebook.delete",
      entityType: "Pricebook",
      entityId: pricebook.id,
      before,
      after: pricebook,
      request,
    });

    return NextResponse.json({ pricebook });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
