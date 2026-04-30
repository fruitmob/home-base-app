import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Role, VideoStatus } from "@/generated/prisma/client";
import { POST as createShareLink } from "@/app/api/videos/[id]/share/route";
import { db } from "@/lib/db";

const csrfToken = "lens-share-smoke-csrf";

type TestSession = {
  userId: string;
  sessionId: string;
};

async function main() {
  const sessions: TestSession[] = [];
  const videoIds: string[] = [];
  const shareLinkIds: string[] = [];

  try {
    const serviceWriter = await createTestSession(Role.SERVICE_WRITER, "writer");
    const tech = await createTestSession(Role.TECH, "tech");
    sessions.push(serviceWriter, tech);

    const readyVideo = await db.video.create({
      data: {
        cloudflareId: `cf-ready-${randomUUID()}`,
        title: "Shareable walkaround",
        uploadedByUserId: serviceWriter.userId,
        status: VideoStatus.READY,
      },
    });
    videoIds.push(readyVideo.id);

    const processingVideo = await db.video.create({
      data: {
        cloudflareId: `cf-processing-${randomUUID()}`,
        title: "Processing walkaround",
        uploadedByUserId: serviceWriter.userId,
        status: VideoStatus.PROCESSING,
      },
    });
    videoIds.push(processingVideo.id);

    const unauthorized = await createShareLink(
      requestFor(readyVideo.id, tech.sessionId),
      routeContext(readyVideo.id),
    );
    await expectStatus(unauthorized, 403, "tech cannot create share link");

    const notReady = await createShareLink(
      requestFor(processingVideo.id, serviceWriter.sessionId),
      routeContext(processingVideo.id),
    );
    await expectStatus(notReady, 400, "processing video cannot be shared");

    const created = await createShareLink(
      requestFor(readyVideo.id, serviceWriter.sessionId),
      routeContext(readyVideo.id),
    );
    await expectStatus(created, 201, "ready video can be shared");
    const body = (await created.json()) as {
      shareLink: { id: string; token: string; viewCount: number };
      shareUrl: string;
    };
    shareLinkIds.push(body.shareLink.id);

    assert.match(body.shareUrl, /\/lens\//);
    assert.equal(body.shareLink.viewCount, 0);
    assert.ok(body.shareLink.token.length > 32);

    const auditRow = await db.auditLog.findFirst({
      where: {
        action: "video.share_link.create",
        entityType: "VideoShareLink",
        entityId: body.shareLink.id,
      },
    });
    assert.ok(auditRow, "share link creation should be audited");

    console.log("Lens share smoke test: OK");
  } finally {
    if (shareLinkIds.length) {
      await db.auditLog.deleteMany({ where: { entityId: { in: shareLinkIds } } });
      await db.videoShareLink.deleteMany({ where: { id: { in: shareLinkIds } } });
    }

    if (videoIds.length) {
      await db.video.deleteMany({ where: { id: { in: videoIds } } });
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
}

function routeContext(id: string) {
  return { params: { id } };
}

function requestFor(videoId: string, sessionId: string | null) {
  return new Request(`http://homebase.local/api/videos/${videoId}/share`, {
    method: "POST",
    headers: {
      ...(sessionId ? { cookie: `hb_session=${sessionId}; hb_csrf=${csrfToken}` } : {}),
      "x-csrf-token": csrfToken,
      "content-type": "application/json",
    },
  });
}

async function createTestSession(role: Role, label: string): Promise<TestSession> {
  const id = randomUUID();
  const user = await db.user.create({
    data: {
      email: `lens-share-${label}-${id}@example.test`,
      passwordHash: "not-used",
      role,
    },
  });
  const sessionId = `lens-share-${id}`;

  await db.session.create({
    data: {
      id: sessionId,
      userId: user.id,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      ipAddress: "127.0.0.1",
      userAgent: "lens-share-smoke-test",
    },
  });

  return { userId: user.id, sessionId };
}

async function expectStatus(response: Response, expected: number, label: string) {
  if (response.status !== expected) {
    throw new Error(`${label} returned ${response.status}: ${await response.text()}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
