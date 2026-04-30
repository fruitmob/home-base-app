import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth";
import { apiErrorResponse, verifyMutationCsrf } from "@/lib/core/api";
import { canShareVideos } from "@/lib/core/permissions";
import { db } from "@/lib/db";

type RouteContext = {
  params: { id: string };
};

const DEFAULT_SHARE_DAYS = 14;

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const user = await requireAuth(request);
    verifyMutationCsrf(request);

    if (!canShareVideos(user.role)) {
      return NextResponse.json({ error: "You do not have access to share videos." }, { status: 403 });
    }

    const video = await db.video.findFirst({
      where: { id: params.id, deletedAt: null },
    });

    if (!video) {
      return NextResponse.json({ error: "Video not found." }, { status: 404 });
    }

    if (video.status !== "READY") {
      return NextResponse.json({ error: "Only ready videos can be shared." }, { status: 400 });
    }

    const expiresAt = new Date(Date.now() + DEFAULT_SHARE_DAYS * 24 * 60 * 60 * 1000);
    const shareLink = await db.videoShareLink.create({
      data: {
        videoId: video.id,
        token: await createUniqueToken(),
        expiresAt,
      },
    });

    await logAudit({
      actorUserId: user.id,
      action: "video.share_link.create",
      entityType: "VideoShareLink",
      entityId: shareLink.id,
      after: shareLink,
      request,
    });

    const requestUrl = new URL(request.url);
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `${requestUrl.protocol}//${requestUrl.host}`;

    return NextResponse.json(
      {
        shareLink: {
          id: shareLink.id,
          token: shareLink.token,
          expiresAt: shareLink.expiresAt,
          viewCount: shareLink.viewCount,
        },
        shareUrl: `${baseUrl.replace(/\/$/, "")}/lens/${shareLink.token}`,
      },
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

async function createUniqueToken() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = randomBytes(32).toString("base64url");
    const existing = await db.videoShareLink.findUnique({ where: { token } });

    if (!existing) {
      return token;
    }
  }

  throw new Error("Unable to create a unique video share token.");
}
