import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Role, VideoStatus } from "@/generated/prisma/client";
import { POST as createUploadToken } from "@/app/api/videos/upload-token/route";
import { POST as cloudflareWebhook } from "@/app/api/webhooks/cloudflare/route";
import { POST as createShareLink } from "@/app/api/videos/[id]/share/route";
import LensPlaybackPage from "@/app/lens/[token]/page";
import { db } from "@/lib/db";

const csrfToken = "lens-e2e-smoke-csrf";

type TestSession = {
  userId: string;
  sessionId: string;
};

async function main() {
  const suffix = randomUUID();
  const webhookSecret = `lens-e2e-${suffix}`;
  const priorEnv = captureEnv();
  const sessions: TestSession[] = [];
  const customerIds: string[] = [];
  const vehicleIds: string[] = [];
  const workOrderIds: string[] = [];
  const videoIds: string[] = [];
  const shareLinkIds: string[] = [];

  process.env.CLOUDFLARE_ACCOUNT_ID = "";
  process.env.CLOUDFLARE_API_TOKEN = "";
  process.env.CLOUDFLARE_STREAM_MOCK = "true";
  process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET = webhookSecret;
  process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE = "smoke";
  process.env.NEXT_PUBLIC_SITE_URL = "https://shop.example.test";

  try {
    const serviceWriter = await createTestSession(Role.SERVICE_WRITER, `writer-${suffix}`);
    const viewer = await createTestSession(Role.VIEWER, `viewer-${suffix}`);
    sessions.push(serviceWriter, viewer);

    const customer = await db.customer.create({
      data: {
        displayName: `Lens Smoke Customer ${suffix}`,
        email: `lens-e2e-${suffix}@example.test`,
      },
    });
    customerIds.push(customer.id);

    const vehicle = await db.vehicle.create({
      data: {
        customerId: customer.id,
        year: 2025,
        make: "Ford",
        model: "F-650",
        unitNumber: `RIP-${suffix.slice(0, 6)}`,
      },
    });
    vehicleIds.push(vehicle.id);

    const workOrder = await db.workOrder.create({
      data: {
        workOrderNumber: `WO-RIP-${suffix.slice(0, 8)}`,
        customerId: customer.id,
        vehicleId: vehicle.id,
        serviceWriterUserId: serviceWriter.userId,
        title: "Lens end-to-end smoke work order",
      },
    });
    workOrderIds.push(workOrder.id);

    const blockedUpload = await createUploadToken(
      uploadRequest(viewer.sessionId, {
        name: "Viewer upload attempt",
        workOrderId: workOrder.id,
      }),
    );
    await expectStatus(blockedUpload, 403, "viewer upload token");

    const upload = await createUploadToken(
      uploadRequest(serviceWriter.sessionId, {
        name: "Customer walkaround",
        workOrderId: workOrder.id,
        customerId: "wrong-customer-id",
        vehicleId: "wrong-vehicle-id",
      }),
    );
    await expectStatus(upload, 200, "upload token create");
    const uploadBody = (await upload.json()) as {
      uploadUrl: string;
      uid: string;
      videoId: string;
    };
    assert.match(uploadBody.uploadUrl, /^mock:\/\//);
    videoIds.push(uploadBody.videoId);

    const createdVideo = await db.video.findUniqueOrThrow({ where: { id: uploadBody.videoId } });
    assert.equal(createdVideo.status, VideoStatus.UPLOADING);
    assert.equal(createdVideo.title, "Customer walkaround");
    assert.equal(createdVideo.uploadedByUserId, serviceWriter.userId);
    assert.equal(createdVideo.workOrderId, workOrder.id);
    assert.equal(createdVideo.customerId, customer.id);
    assert.equal(createdVideo.vehicleId, vehicle.id);

    const processing = await cloudflareWebhook(
      webhookRequest(
        {
          event: "video.encoding.started",
          data: { uid: uploadBody.uid },
        },
        webhookSecret,
      ),
    );
    await expectStatus(processing, 200, "processing webhook");

    const processingVideo = await db.video.findUniqueOrThrow({ where: { id: uploadBody.videoId } });
    assert.equal(processingVideo.status, VideoStatus.PROCESSING);

    const prematureShare = await createShareLink(
      authedRequest(
        `http://homebase.local/api/videos/${uploadBody.videoId}/share`,
        "POST",
        serviceWriter.sessionId,
      ),
      routeContext(uploadBody.videoId),
    );
    await expectStatus(prematureShare, 400, "processing video share");

    const ready = await cloudflareWebhook(
      webhookRequest(
        {
          type: "video.ready",
          result: {
            uid: uploadBody.uid,
            duration: "91.2",
            thumbnailUrl: "https://example.test/lens-thumb.jpg",
          },
        },
        webhookSecret,
      ),
    );
    await expectStatus(ready, 200, "ready webhook");

    const readyVideo = await db.video.findUniqueOrThrow({ where: { id: uploadBody.videoId } });
    assert.equal(readyVideo.status, VideoStatus.READY);
    assert.equal(readyVideo.durationSeconds, 91);
    assert.equal(readyVideo.thumbnailUrl, "https://example.test/lens-thumb.jpg");

    const share = await createShareLink(
      authedRequest(
        `http://homebase.local/api/videos/${uploadBody.videoId}/share`,
        "POST",
        serviceWriter.sessionId,
      ),
      routeContext(uploadBody.videoId),
    );
    await expectStatus(share, 201, "ready video share");
    const shareBody = (await share.json()) as {
      shareLink: { id: string; token: string; viewCount: number };
      shareUrl: string;
    };
    shareLinkIds.push(shareBody.shareLink.id);
    assert.equal(shareBody.shareLink.viewCount, 0);
    assert.equal(shareBody.shareUrl, `https://shop.example.test/lens/${shareBody.shareLink.token}`);

    await LensPlaybackPage({ params: { token: shareBody.shareLink.token } });

    const viewedShareLink = await db.videoShareLink.findUniqueOrThrow({
      where: { id: shareBody.shareLink.id },
    });
    assert.equal(viewedShareLink.viewCount, 1);

    await assertAuditRows([
      ["video.webhook_status", "Video", uploadBody.videoId],
      ["video.share_link.create", "VideoShareLink", shareBody.shareLink.id],
    ]);

    console.log("Lens end-to-end smoke test: OK");
  } finally {
    await cleanup({ sessions, customerIds, vehicleIds, workOrderIds, videoIds, shareLinkIds });
    restoreEnv(priorEnv);
    await db.$disconnect();
  }
}

function routeContext(id: string) {
  return { params: { id } };
}

function uploadRequest(sessionId: string, body: unknown) {
  return jsonRequest("http://homebase.local/api/videos/upload-token", "POST", sessionId, body);
}

function webhookRequest(body: unknown, secret: string) {
  return new Request("http://homebase.local/api/webhooks/cloudflare", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-cloudflare-webhook-secret": secret,
    },
    body: JSON.stringify(body),
  });
}

function jsonRequest(url: string, method: string, sessionId: string, body: unknown) {
  return new Request(url, {
    method,
    headers: {
      ...authHeaders(sessionId),
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function authedRequest(url: string, method: string, sessionId: string) {
  return new Request(url, {
    method,
    headers: authHeaders(sessionId),
  });
}

function authHeaders(sessionId: string) {
  return {
    cookie: `hb_session=${sessionId}; hb_csrf=${csrfToken}`,
    "x-csrf-token": csrfToken,
    "user-agent": "lens-e2e-smoke-test",
    "x-forwarded-for": "127.0.0.1",
  };
}

async function createTestSession(role: Role, label: string): Promise<TestSession> {
  const user = await db.user.create({
    data: {
      email: `lens-e2e-${label}@example.test`,
      passwordHash: "not-used",
      role,
    },
  });
  const sessionId = `lens-e2e-${randomUUID()}`;

  await db.session.create({
    data: {
      id: sessionId,
      userId: user.id,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      ipAddress: "127.0.0.1",
      userAgent: "lens-e2e-smoke-test",
    },
  });

  return { userId: user.id, sessionId };
}

async function expectStatus(response: Response, expected: number, label: string) {
  if (response.status !== expected) {
    throw new Error(`${label} returned ${response.status}: ${await response.text()}`);
  }
}

async function assertAuditRows(rows: Array<[string, string, string]>) {
  for (const [action, entityType, entityId] of rows) {
    const auditRow = await db.auditLog.findFirst({
      where: { action, entityType, entityId },
    });

    assert.ok(auditRow, `Missing audit row for ${action} ${entityId}`);
  }
}

async function cleanup({
  sessions,
  customerIds,
  vehicleIds,
  workOrderIds,
  videoIds,
  shareLinkIds,
}: {
  sessions: TestSession[];
  customerIds: string[];
  vehicleIds: string[];
  workOrderIds: string[];
  videoIds: string[];
  shareLinkIds: string[];
}) {
  const auditEntityIds = [...videoIds, ...shareLinkIds, ...workOrderIds];

  if (auditEntityIds.length) {
    await db.auditLog.deleteMany({ where: { entityId: { in: auditEntityIds } } });
  }

  if (shareLinkIds.length) {
    await db.videoShareLink.deleteMany({ where: { id: { in: shareLinkIds } } });
  }

  if (videoIds.length) {
    await db.video.deleteMany({ where: { id: { in: videoIds } } });
  }

  if (workOrderIds.length) {
    await db.workOrder.deleteMany({ where: { id: { in: workOrderIds } } });
  }

  if (vehicleIds.length) {
    await db.vehicle.deleteMany({ where: { id: { in: vehicleIds } } });
  }

  if (customerIds.length) {
    await db.customer.deleteMany({ where: { id: { in: customerIds } } });
  }

  if (sessions.length) {
    await db.session.deleteMany({
      where: { id: { in: sessions.map((session) => session.sessionId) } },
    });
    await db.user.deleteMany({
      where: { id: { in: sessions.map((session) => session.userId) } },
    });
  }
}

function captureEnv() {
  return {
    NODE_ENV: process.env.NODE_ENV,
    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
    CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
    CLOUDFLARE_STREAM_MOCK: process.env.CLOUDFLARE_STREAM_MOCK,
    CLOUDFLARE_STREAM_WEBHOOK_SECRET: process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET,
    CLOUDFLARE_STREAM_CUSTOMER_CODE: process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  };
}

function restoreEnv(values: ReturnType<typeof captureEnv>) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
