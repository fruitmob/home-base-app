import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";
import { EstimateStatus } from "@/generated/prisma/client";
import { requireAuth } from "@/lib/auth";
import { apiErrorResponse, readJsonObject } from "@/lib/core/api";
import { db } from "@/lib/db";
import { readRequiredString, parseEnum } from "@/lib/core/validators";
import { emitWebhook } from "@/lib/webhooks/dispatch";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth(request);
    const input = await readJsonObject(request);
    
    // We expect a literal string representing the new status.
    const newStatusString = readRequiredString(input as Record<string, unknown>, "status");
    const status = parseEnum(newStatusString, EstimateStatus, "status", EstimateStatus.DRAFT);

    const estimate = await db.estimate.findUnique({
      where: { id: params.id, deletedAt: null },
    });

    if (!estimate) {
      return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
    }

    const updates: any /* eslint-disable-line @typescript-eslint/no-explicit-any */ = { status };

    if (status === "SENT" && !estimate.sentAt) {
      updates.sentAt = new Date();
    } else if (status === "APPROVED" && !estimate.approvedAt) {
      updates.approvedAt = new Date();
    } else if (status === "DECLINED" && !estimate.declinedAt) {
      updates.declinedAt = new Date();
    }

    const updated = await db.estimate.update({
      where: { id: params.id },
      data: updates,
    });

    if (
      status === EstimateStatus.APPROVED &&
      estimate.status !== EstimateStatus.APPROVED
    ) {
      await emitWebhook({
        eventType: "estimate.approved",
        payload: {
          estimateId: updated.id,
          estimateNumber: updated.estimateNumber,
          customerId: updated.customerId,
          vehicleId: updated.vehicleId,
          total: Number(updated.total),
          approvedAt: (updated.approvedAt ?? new Date()).toISOString(),
        },
      }).catch((error) => {
        console.error("[webhook] failed to emit estimate.approved", error);
      });
    }

    return NextResponse.json({ estimate: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
