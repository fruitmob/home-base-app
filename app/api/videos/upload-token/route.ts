import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requestDirectUploadUrl, type CloudflareUploadMeta } from "@/lib/video/cloudflare";
import { apiErrorResponse, verifyMutationCsrf } from "@/lib/core/api";
import { canUploadVideos } from "@/lib/core/permissions";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    verifyMutationCsrf(request);

    if (!canUploadVideos(user.role)) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    const json = await request.json().catch(() => ({}));
    const name = typeof json?.name === "string" && json.name.trim() ? json.name.trim() : `Upload by ${user.id}`;
    const workOrderId =
      typeof json?.workOrderId === "string" && json.workOrderId.trim()
        ? json.workOrderId.trim()
        : null;
    const explicitCustomerId =
      typeof json?.customerId === "string" && json.customerId.trim()
        ? json.customerId.trim()
        : null;
    const explicitVehicleId =
      typeof json?.vehicleId === "string" && json.vehicleId.trim()
        ? json.vehicleId.trim()
        : null;

    let customerId = explicitCustomerId;
    let vehicleId = explicitVehicleId;

    if (workOrderId) {
      const workOrder = await db.workOrder.findFirst({
        where: { id: workOrderId, deletedAt: null },
        select: { id: true, customerId: true, vehicleId: true },
      });

      if (!workOrder) {
        return NextResponse.json({ error: "Work order not found" }, { status: 404 });
      }

      customerId = workOrder.customerId;
      vehicleId = workOrder.vehicleId;
    }

    const meta: CloudflareUploadMeta["meta"] = { userId: user.id };
    if (workOrderId) meta.workOrderId = workOrderId;
    if (customerId) meta.customerId = customerId;
    if (vehicleId) meta.vehicleId = vehicleId;

    // Request URL from Cloudflare wrapper
    const { uploadUrl, uid } = await requestDirectUploadUrl({
      name,
      creator: user.id,
      requireSignedURLs: true,
      meta,
    });

    // Create tracking row in our database instantly
    const video = await db.video.create({
      data: {
        cloudflareId: uid,
        status: "UPLOADING",
        title: name,
        uploadedByUserId: user.id,
        workOrderId,
        customerId,
        vehicleId,
      },
    });

    return NextResponse.json({
      uploadUrl,
      uid,
      videoId: video.id,
    });
  } catch (error) {
    try {
      return apiErrorResponse(error);
    } catch {
      // Fall through to a generic response for provider/network errors.
    }

    console.error("Failed to generate upload token", error);
    return NextResponse.json({ error: "Failed to generate upload token" }, { status: 500 });
  }
}
