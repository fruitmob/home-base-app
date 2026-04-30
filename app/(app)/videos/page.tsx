import Link from "next/link";
import { VideoStatus } from "@/generated/prisma/client";
import { canShareVideos } from "@/lib/core/permissions";
import { requirePageUser } from "@/lib/core/pageAuth";
import { db } from "@/lib/db";

type VideosPageProps = {
  searchParams?: {
    q?: string;
    status?: string;
  };
};

export default async function VideosPage({ searchParams }: VideosPageProps) {
  const user = await requirePageUser();
  const canCreateShareLinks = canShareVideos(user.role);
  const q = searchParams?.q?.trim();
  const rawStatus = searchParams?.status;
  const status = isVideoStatus(rawStatus) ? rawStatus : undefined;

  const videos = await db.video.findMany({
    where: {
      deletedAt: null,
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
              { cloudflareId: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      uploadedByUser: { select: { id: true, email: true } },
      customer: { select: { id: true, displayName: true } },
      vehicle: { select: { id: true, year: true, make: true, model: true, unitNumber: true } },
      workOrder: { select: { id: true, workOrderNumber: true, title: true } },
      shareLinks: {
        where: { deletedAt: null },
        select: { id: true, expiresAt: true, viewCount: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase text-blue-600 dark:text-blue-300">
            Lens
          </p>
          <h2 className="mt-2 text-3xl font-black text-slate-950 dark:text-white">
            Video library
          </h2>
          <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">
            Walkarounds, repair explanations, delivery notes, and customer-ready clips.
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900">
          <span className="font-black text-slate-950 dark:text-white">{videos.length}</span>{" "}
          <span className="text-slate-500 dark:text-slate-400">videos found</span>
        </div>
      </div>

      <form className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-[1fr_220px_auto]">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search title, description, or Cloudflare id"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        >
          <option value="">All statuses</option>
          {Object.values(VideoStatus).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="min-h-11 rounded-lg bg-slate-950 px-4 py-2 text-sm font-black text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
        >
          Filter
        </button>
      </form>

      {videos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-900">
          <p className="font-black text-slate-950 dark:text-white">No videos yet.</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Upload from a work order to start building the Lens library.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {videos.map((video) => (
            <article
              key={video.id}
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <Link
                    href={`/videos/${video.id}`}
                    className="break-words text-lg font-black text-slate-950 hover:underline dark:text-white"
                  >
                    {video.title}
                  </Link>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Uploaded {video.createdAt.toLocaleDateString()} by {video.uploadedByUser.email}
                  </p>
                </div>
                <span className={`${statusClassName(video.status)} self-start sm:shrink-0`}>
                  {video.status}
                </span>
              </div>

              <div className="mt-4 grid gap-3 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-2">
                {video.workOrder ? (
                  <Link href={`/work-orders/${video.workOrder.id}`} className="break-words font-bold text-blue-600 hover:underline dark:text-blue-300">
                    {video.workOrder.workOrderNumber}
                  </Link>
                ) : (
                  <span>No work order</span>
                )}
                <span>{video.customer?.displayName ?? "No customer"}</span>
                <span>
                  {video.vehicle
                    ? [video.vehicle.unitNumber, video.vehicle.year, video.vehicle.make, video.vehicle.model]
                        .filter(Boolean)
                        .join(" ")
                    : "No vehicle"}
                </span>
                <span>
                  {video.shareLinks[0]
                    ? `${video.shareLinks[0].viewCount} views on latest share`
                    : canCreateShareLinks && video.status === "READY"
                      ? "Ready to share"
                      : "No share link"}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function isVideoStatus(value: string | undefined): value is VideoStatus {
  return !!value && Object.values(VideoStatus).includes(value as VideoStatus);
}

function statusClassName(status: VideoStatus) {
  const base = "rounded-full px-2 py-1 text-xs font-black";

  if (status === VideoStatus.READY) return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200`;
  if (status === VideoStatus.FAILED) return `${base} bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-200`;
  if (status === VideoStatus.PROCESSING) return `${base} bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200`;
  return `${base} bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200`;
}
