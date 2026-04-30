import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { VideoStatus } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";

type CloudflareWebhookPayload = {
  event?: unknown;
  type?: unknown;
  eventType?: unknown;
  uid?: unknown;
  status?: unknown;
  duration?: unknown;
  thumbnail?: unknown;
  thumbnailUrl?: unknown;
  data?: CloudflareWebhookPayload;
  result?: CloudflareWebhookPayload;
  video?: CloudflareWebhookPayload;
};

export async function POST(request: Request) {
  const secret = process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET;

  if (!secret) {
    return NextResponse.json({ error: "Cloudflare webhook secret is not configured" }, { status: 500 });
  }

  if (!hasValidSecret(request, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as CloudflareWebhookPayload | null;

  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Webhook body must be a JSON object" }, { status: 400 });
  }

  const cloudflareId = pickString(payload, "uid");

  if (!cloudflareId) {
    return NextResponse.json({ error: "Cloudflare video uid is required" }, { status: 400 });
  }

  const nextStatus = mapCloudflareStatus(
    pickString(payload, "event") ??
      pickString(payload, "type") ??
      pickString(payload, "eventType") ??
      pickString(payload, "status"),
  );

  if (!nextStatus) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const existing = await db.video.findFirst({
    where: { cloudflareId, deletedAt: null },
  });

  if (!existing) {
    return NextResponse.json({ ok: true, ignored: true }, { status: 202 });
  }

  const updated = await db.video.update({
    where: { id: existing.id },
    data: {
      status: nextStatus,
      durationSeconds: pickDurationSeconds(payload) ?? existing.durationSeconds,
      thumbnailUrl:
        pickString(payload, "thumbnailUrl") ??
        pickString(payload, "thumbnail") ??
        existing.thumbnailUrl,
    },
  });

  await logAudit({
    action: "video.webhook_status",
    entityType: "Video",
    entityId: updated.id,
    before: existing,
    after: updated,
    request,
  });

  return NextResponse.json({ ok: true, videoId: updated.id, status: updated.status });
}

function hasValidSecret(request: Request, expected: string) {
  const provided =
    request.headers.get("x-cloudflare-webhook-secret") ??
    request.headers.get("cf-webhook-auth") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!provided) {
    return false;
  }

  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  return (
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer)
  );
}

function pickString(payload: CloudflareWebhookPayload, field: keyof CloudflareWebhookPayload): string | null {
  const direct = payload[field];

  if (typeof direct === "string" && direct.trim()) {
    return direct.trim();
  }

  for (const nested of [payload.video, payload.data, payload.result]) {
    if (nested && typeof nested === "object") {
      const value = pickString(nested, field);
      if (value) return value;
    }
  }

  return null;
}

function pickDurationSeconds(payload: CloudflareWebhookPayload): number | null {
  const direct = payload.duration;

  if (typeof direct === "number" && Number.isFinite(direct)) {
    return Math.max(0, Math.round(direct));
  }

  if (typeof direct === "string" && direct.trim()) {
    const parsed = Number(direct);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.round(parsed));
    }
  }

  for (const nested of [payload.video, payload.data, payload.result]) {
    if (nested && typeof nested === "object") {
      const value = pickDurationSeconds(nested);
      if (value !== null) return value;
    }
  }

  return null;
}

function mapCloudflareStatus(value: string | null): VideoStatus | null {
  const normalized = value?.toLowerCase();

  if (!normalized) {
    return null;
  }

  if (
    normalized.includes("encoding.completed") ||
    normalized.includes("ready") ||
    normalized === "completed"
  ) {
    return VideoStatus.READY;
  }

  if (
    normalized.includes("failed") ||
    normalized.includes("error")
  ) {
    return VideoStatus.FAILED;
  }

  if (
    normalized.includes("processing") ||
    normalized.includes("encoding.started")
  ) {
    return VideoStatus.PROCESSING;
  }

  return null;
}
