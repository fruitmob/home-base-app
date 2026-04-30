import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Role, VideoStatus } from "@/generated/prisma/client";
import { POST as cloudflareWebhook } from "@/app/api/webhooks/cloudflare/route";
import { db } from "@/lib/db";

const webhookSecret = `lens-webhook-${randomUUID()}`;

async function main() {
  const priorSecret = process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET;
  process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET = webhookSecret;

  const user = await db.user.create({
    data: {
      email: `lens-webhook-${randomUUID()}@example.test`,
      passwordHash: "not-used",
      role: Role.TECH,
    },
  });

  const video = await db.video.create({
    data: {
      cloudflareId: `cf-${randomUUID()}`,
      title: "Webhook smoke video",
      uploadedByUserId: user.id,
      status: VideoStatus.UPLOADING,
    },
  });

  try {
    const rejected = await cloudflareWebhook(
      jsonRequest({ event: "video.encoding.completed", video: { uid: video.cloudflareId } }, "wrong"),
    );
    assert.equal(rejected.status, 401, "webhook must reject invalid secrets");

    const completed = await cloudflareWebhook(
      jsonRequest(
        {
          event: "video.encoding.completed",
          video: {
            uid: video.cloudflareId,
            duration: 12.6,
            thumbnailUrl: "https://example.test/thumb.jpg",
          },
        },
        webhookSecret,
      ),
    );
    assert.equal(completed.status, 200, "completed webhook should be accepted");

    const readyVideo = await db.video.findUniqueOrThrow({ where: { id: video.id } });
    assert.equal(readyVideo.status, VideoStatus.READY);
    assert.equal(readyVideo.durationSeconds, 13);
    assert.equal(readyVideo.thumbnailUrl, "https://example.test/thumb.jpg");

    const auditRow = await db.auditLog.findFirst({
      where: {
        action: "video.webhook_status",
        entityType: "Video",
        entityId: video.id,
      },
    });
    assert.ok(auditRow, "webhook status changes should be audited");

    const failed = await cloudflareWebhook(
      jsonRequest({ type: "video.failed", data: { uid: video.cloudflareId } }, webhookSecret),
    );
    assert.equal(failed.status, 200, "failed webhook should be accepted");

    const failedVideo = await db.video.findUniqueOrThrow({ where: { id: video.id } });
    assert.equal(failedVideo.status, VideoStatus.FAILED);

    console.log("Lens webhook smoke test: OK");
  } finally {
    await db.auditLog.deleteMany({ where: { entityId: video.id } });
    await db.video.deleteMany({ where: { id: video.id } });
    await db.user.deleteMany({ where: { id: user.id } });

    if (priorSecret === undefined) {
      delete process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET;
    } else {
      process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET = priorSecret;
    }
  }
}

function jsonRequest(body: unknown, secret: string) {
  return new Request("http://homebase.local/api/webhooks/cloudflare", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-cloudflare-webhook-secret": secret,
    },
    body: JSON.stringify(body),
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
