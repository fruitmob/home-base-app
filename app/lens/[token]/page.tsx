import React from "react";
import { notFound } from "next/navigation";
import { VideoStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getPlaybackTokens, getStreamIframeUrl } from "@/lib/video/cloudflare";

type LensPlaybackPageProps = {
  params: { token: string };
};

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Lens Video",
  robots: { index: false, follow: false },
};

export default async function LensPlaybackPage({ params }: LensPlaybackPageProps) {
  const shareLink = await db.videoShareLink.findUnique({
    where: { token: params.token },
    include: {
      video: {
        include: {
          customer: { select: { displayName: true } },
          workOrder: { select: { workOrderNumber: true, title: true } },
        },
      },
    },
  });

  if (
    !shareLink ||
    shareLink.deletedAt ||
    (shareLink.expiresAt && shareLink.expiresAt < new Date()) ||
    shareLink.video.deletedAt ||
    shareLink.video.status !== VideoStatus.READY
  ) {
    notFound();
  }

  await db.videoShareLink.update({
    where: { id: shareLink.id },
    data: { viewCount: { increment: 1 } },
  });

  const playback = await getCustomerPlayback(shareLink.video.cloudflareId);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-6 sm:px-5 sm:py-8">
        <header className="mb-6">
          <p className="text-sm font-semibold uppercase text-blue-300">Lens Video</p>
          <h1 className="mt-3 break-words text-3xl font-black">
            {shareLink.video.title}
          </h1>
          <p className="mt-3 max-w-2xl break-words text-slate-300">
            {shareLink.video.workOrder
              ? `${shareLink.video.workOrder.workOrderNumber}: ${shareLink.video.workOrder.title}`
              : shareLink.video.customer?.displayName ?? "Service video"}
          </p>
        </header>

        <div className="overflow-hidden rounded-lg border border-slate-800 bg-black shadow-2xl">
          {playback?.iframeUrl ? (
            <div className="relative aspect-video">
              <iframe
                src={playback.iframeUrl}
                title={shareLink.video.title}
                className="absolute inset-0 h-full w-full border-0"
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="flex aspect-video min-h-[220px] items-center justify-center p-5 text-center sm:p-8">
              <div>
                <p className="text-xl font-black">Playback is being configured.</p>
                <p className="mt-2 text-sm text-slate-400">
                  The shop needs to finish Cloudflare Stream setup before this video can play.
                </p>
              </div>
            </div>
          )}
        </div>

        {shareLink.video.description ? (
          <article className="mt-6 rounded-lg border border-slate-800 bg-slate-900 p-5 text-slate-200">
            <h2 className="text-lg font-black">Notes</h2>
            <p className="mt-3 whitespace-pre-wrap">{shareLink.video.description}</p>
          </article>
        ) : null}

        <footer className="mt-auto pt-8 text-sm text-slate-500">
          This secure link is intended for the recipient only.
        </footer>
      </section>
    </main>
  );
}

async function getCustomerPlayback(cloudflareId: string) {
  try {
    const { token } = await getPlaybackTokens(cloudflareId);
    return { iframeUrl: getStreamIframeUrl(token) };
  } catch (error) {
    console.error("Failed to create customer Lens playback token", error);
    return null;
  }
}
