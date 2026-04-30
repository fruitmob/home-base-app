import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import {
  apiErrorResponse,
  readJsonObject,
  requireVendorWrite,
} from "@/lib/core/api";
import { parseVendorInput } from "@/lib/core/validators";
import { findActiveVendor, vendorDetailInclude } from "@/lib/core/vendors";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(request: Request, { params }: RouteContext) {
  try {
    await requireAuth(request);

    const vendor = await findActiveVendor(params.id);

    return NextResponse.json({ vendor });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const user = await requireVendorWrite(request);
    const body = await readJsonObject(request);
    const before = await findActiveVendor(params.id);
    const input = parseVendorInput({ ...before, ...body });
    const vendor = await db.vendor.update({
      where: { id: before.id },
      data: input,
      include: vendorDetailInclude,
    });

    await logAudit({
      actorUserId: user.id,
      action: "vendor.update",
      entityType: "Vendor",
      entityId: vendor.id,
      before,
      after: vendor,
      request,
    });

    return NextResponse.json({ vendor });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const user = await requireVendorWrite(request);
    const before = await findActiveVendor(params.id);
    const vendor = await db.vendor.update({
      where: { id: before.id },
      data: { deletedAt: new Date() },
      include: vendorDetailInclude,
    });

    await logAudit({
      actorUserId: user.id,
      action: "vendor.delete",
      entityType: "Vendor",
      entityId: vendor.id,
      before,
      after: vendor,
      request,
    });

    return NextResponse.json({ vendor });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
