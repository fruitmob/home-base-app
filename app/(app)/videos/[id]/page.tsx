import Link from "next/link";
import { notFound } from "next/navigation";
import { VideoStatus } from "@/generated/prisma/client";
import { VideoShareButton } from "@/components/video/VideoShareButton";
import { canShareVideos } from "@/lib/core/permissions";
import { requirePageUser } from "@/lib/core/pageAuth";
import { db } from "@/lib/db";
import { getPlaybackTokens, getStreamIframeUrl } from "@/lib/video/cloudflare";

type VideoDetailPageProps = {
  params: { id: string };
};

export default async function VideoDetailPage({ params }: VideoDetailPageProps) {
  const user = await requirePageUser();
  const video = await db.video.findFirst({
    where: { id: params.id, deletedAt: null },
    include: {
      uploadedByUser: { select: { id: true, email: true } },
      customer: { select: { id: true, displayName: true } },
      vehicle: { select: { id: true, year: true, make: true, model: true, unitNumber: true } },
      workOrder: { select: { id: true, workOrderNumber: true, title: true } },
      shareLinks: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  if (!video) {
    notFound();
  }

  const canCreateShareLinks = canShareVideos(user.role);
  const playback = video.status === VideoStatus.READY ? await getPlayback(video.cloudflareId) : null;

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <Link href="/videos" className="text-sm font-bold text-blue-600 hover:underline dark:text-blue-300">
            Back to Lens library
          </Link>
          <h2 className="mt-3 break-words text-3xl font-black text-slate-950 dark:text-white">
            {video.title}
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Uploaded {video.createdAt.toLocaleString()} by {video.uploadedByUser.email}
          </p>
        </div>
        <span className={`${statusClassName(video.status)} self-start`}>{video.status}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <article className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            {playback?.iframeUrl ? (
              <div className="relative aspect-video bg-black">
                <iframe
                  src={playback.iframeUrl}
                  title={video.title}
                  className="absolute inset-0 h-full w-full border-0"
                  allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="flex aspect-video min-h-[220px] items-center justify-center bg-slate-100 p-5 text-center dark:bg-slate-950 sm:p-8">
                <div>
                  <p className="text-lg font-black text-slate-950 dark:text-white">
                    {video.status === VideoStatus.READY
                      ? "Playback needs Cloudflare Stream configuration."
                      : "Video is not ready for playback yet."}
                  </p>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    {video.status === VideoStatus.READY
                      ? "Set real Cloudflare credentials and the Stream customer code before live playback."
                      : "The webhook will update this video when Cloudflare finishes processing."}
                  </p>
                </div>
              </div>
            )}
          </article>

          {video.description ? (
            <article className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-lg font-black text-slate-950 dark:text-white">Notes</h3>
              <p className="mt-3 whitespace-pre-wrap text-slate-600 dark:text-slate-300">{video.description}</p>
            </article>
          ) : null}
        </div>

        <aside className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-lg font-black text-slate-950 dark:text-white">Share</h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Customer links expire after 14 days.
            </p>
            <div className="mt-4">
              {video.status === VideoStatus.READY ? (
                <VideoShareButton videoId={video.id} canShare={canCreateShareLinks} />
              ) : (
                <p className="rounded-lg border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  Sharing unlocks when the video is ready.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-lg font-black text-slate-950 dark:text-white">Linked records</h3>
            <div className="mt-4 space-y-3 text-sm">
              {video.workOrder ? (
                <Link href={`/work-orders/${video.workOrder.id}`} className="block break-words font-bold text-blue-600 hover:underline dark:text-blue-300">
                  {video.workOrder.workOrderNumber}: {video.workOrder.title}
                </Link>
              ) : null}
              {video.customer ? (
                <Link href={`/customers/${video.customer.id}`} className="block break-words font-bold text-blue-600 hover:underline dark:text-blue-300">
                  {video.customer.displayName}
                </Link>
              ) : null}
              {video.vehicle ? (
                <Link href={`/vehicles/${video.vehicle.id}`} className="block break-words font-bold text-blue-600 hover:underline dark:text-blue-300">
                  {[video.vehicle.unitNumber, video.vehicle.year, video.vehicle.make, video.vehicle.model]
                    .filter(Boolean)
                    .join(" ")}
                </Link>
              ) : null}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-lg font-black text-slate-950 dark:text-white">Recent links</h3>
            <div className="mt-4 space-y-3">
              {video.shareLinks.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  No customer links yet.
                </p>
              ) : (
                video.shareLinks.map((link) => (
                  <div key={link.id} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
                    <p className="font-bold text-slate-950 dark:text-white">{link.viewCount} views</p>
                    <p className="mt-1 text-slate-500 dark:text-slate-400">
                      {link.expiresAt ? `Expires ${link.expiresAt.toLocaleDateString()}` : "No expiration"}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}

async function getPlayback(cloudflareId: string) {
  try {
    const { token } = await getPlaybackTokens(cloudflareId);
    return { iframeUrl: getStreamIframeUrl(token) };
  } catch (error) {
    console.error("Failed to create internal Lens playback token", error);
    return null;
  }
}

function statusClassName(status: VideoStatus) {
  const base = "rounded-full px-2 py-1 text-xs font-black";

  if (status === VideoStatus.READY) return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200`;
  if (status === VideoStatus.FAILED) return `${base} bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-200`;
  if (status === VideoStatus.PROCESSING) return `${base} bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200`;
  return `${base} bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200`;
}
