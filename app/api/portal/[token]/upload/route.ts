import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPortalToken } from "@/lib/shop/portal";
import { createPresignedUploadUrl } from "@/lib/core/s3";
import { emitWebhook } from "@/lib/webhooks/dispatch";
import { randomUUID } from "crypto";

export async function POST(
  request: Request,
  { params }: { params: { token: string } }
) {
  try {
    const check = await verifyPortalToken(params.token);
    if (!check.valid || !check.token) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    const { fileName, fileType, fileSize, workOrderId } = await request.json();

    if (!check.token.customerId) {
      return NextResponse.json({ error: "Portal token is not linked to a customer" }, { status: 400 });
    }

    if (
      typeof fileName !== "string" ||
      !fileName.trim() ||
      typeof fileType !== "string" ||
      !fileType.trim() ||
      typeof fileSize !== "number" ||
      !Number.isFinite(fileSize) ||
      fileSize <= 0
    ) {
      return NextResponse.json({ error: "Missing file metadata" }, { status: 400 });
    }

    if (fileSize > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Max 10MB." }, { status: 400 });
    }

    let safeWorkOrderId: string | null = null;
    if (typeof workOrderId === "string" && workOrderId.trim()) {
      const workOrder = await db.workOrder.findFirst({
        where: {
          id: workOrderId.trim(),
          customerId: check.token.customerId,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (!workOrder) {
        return NextResponse.json({ error: "Work order not found for this portal" }, { status: 404 });
      }

      safeWorkOrderId = workOrder.id;
    }

    const safeFileName = fileName.trim().replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 180) || "upload";
    const s3Key = `portal-uploads/${check.token.customerId}/${randomUUID()}-${safeFileName}`;
    
    const uploadUrl = await createPresignedUploadUrl(s3Key, fileType);

    const uploadRecord = await db.portalUpload.create({
      data: {
        s3Key,
        fileName,
        fileType,
        fileSize,
        customerId: check.token.customerId,
        workOrderId: safeWorkOrderId,
        status: "NEW",
      },
    });

    await emitWebhook({
      eventType: "portal.upload_received",
      payload: {
        uploadId: uploadRecord.id,
        customerId: uploadRecord.customerId,
        workOrderId: uploadRecord.workOrderId,
        fileName: uploadRecord.fileName,
        fileType: uploadRecord.fileType,
        fileSize: uploadRecord.fileSize,
        createdAt: uploadRecord.createdAt.toISOString(),
      },
    }).catch((error) => {
      console.error("[webhook] failed to emit portal.upload_received", error);
    });

    return NextResponse.json({ success: true, uploadUrl, uploadRecord });
  } catch (error) {
    const err = error as Error;
    console.error("[POST /api/portal/.../upload]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
