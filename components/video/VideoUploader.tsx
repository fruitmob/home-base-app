"use client";

import { useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";

type VideoStatus = "UPLOADING" | "PROCESSING" | "READY" | "FAILED";

type VideoSummary = {
  id: string;
  title: string;
  status: VideoStatus;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  createdAt: string;
};

type UploadTokenResponse = {
  uploadUrl: string;
  uid: string;
  videoId: string;
};

type VideoUploaderProps = {
  workOrderId: string;
  customerId: string;
  vehicleId: string | null;
  initialVideos: VideoSummary[];
  canUpload: boolean;
};

export function VideoUploader({
  workOrderId,
  customerId,
  vehicleId,
  initialVideos,
  canUpload,
}: VideoUploaderProps) {
  const [videos, setVideos] = useState(initialVideos);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const defaultTitle = useMemo(() => {
    if (file?.name) {
      return file.name.replace(/\.[^.]+$/, "");
    }

    return "Work order video";
  }, [file]);

  async function handleUpload() {
    if (!file || isUploading) return;

    setIsUploading(true);
    setError(null);
    setMessage("Preparing upload...");

    try {
      const response = await apiFetch("/api/videos/upload-token", {
        method: "POST",
        body: JSON.stringify({
          name: title.trim() || defaultTitle,
          workOrderId,
          customerId,
          vehicleId,
        }),
      });

      const body = (await response.json()) as Partial<UploadTokenResponse> & { error?: string };

      if (!response.ok || !body.uploadUrl || !body.videoId) {
        throw new Error(body.error ?? "Could not create an upload token.");
      }

      const createdVideo: VideoSummary = {
        id: body.videoId,
        title: title.trim() || defaultTitle,
        status: "UPLOADING",
        thumbnailUrl: null,
        durationSeconds: null,
        createdAt: new Date().toISOString(),
      };

      setVideos((current) => [createdVideo, ...current]);
      setMessage("Uploading video...");

      if (body.uploadUrl.startsWith("mock://")) {
        setMessage("Upload token created in local mock mode.");
      } else {
        await uploadFileToCloudflare(body.uploadUrl, file);
        setVideos((current) =>
          current.map((video) =>
            video.id === body.videoId ? { ...video, status: "PROCESSING" } : video,
          ),
        );
        setMessage("Upload complete. Cloudflare is processing the video.");
      }

      setFile(null);
      setTitle("");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Video upload failed.");
      setMessage(null);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-xl font-black text-slate-950 dark:text-white">
            Lens Videos
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Walkarounds, repair notes, and customer-ready clips.
          </p>
        </div>
      </div>

      {canUpload ? (
        <div className="mt-5 space-y-3">
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">
            Video title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={defaultTitle}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </label>

          <input
            type="file"
            accept="video/*"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="block w-full max-w-full text-sm text-slate-600 file:mb-2 file:mr-0 file:rounded-lg file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-bold file:text-white hover:file:bg-slate-700 dark:text-slate-300 dark:file:bg-white dark:file:text-slate-950 sm:file:mb-0 sm:file:mr-4"
          />

          <button
            type="button"
            onClick={handleUpload}
            disabled={!file || isUploading}
            className="min-h-11 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700"
          >
            {isUploading ? "Uploading..." : "Upload Video"}
          </button>

          {message ? (
            <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-200">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-5 rounded-lg border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Video uploads are available to service staff.
        </p>
      )}

      <div className="mt-6 space-y-3">
        {videos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No videos attached yet.
          </p>
        ) : (
          videos.map((video) => (
            <div
              key={video.id}
              className="rounded-lg border border-slate-200 p-3 dark:border-slate-800"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="break-words text-sm font-black text-slate-950 dark:text-white">{video.title}</p>
                  <p className="mt-1 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                    {video.status}
                    {video.durationSeconds ? ` - ${formatDuration(video.durationSeconds)}` : ""}
                  </p>
                </div>
                <span className={`${statusClassName(video.status)} self-start sm:shrink-0`}>
                  {statusLabel(video.status)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

async function uploadFileToCloudflare(uploadUrl: string, file: File) {
  const createResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Tus-Resumable": "1.0.0",
      "Upload-Length": String(file.size),
      "Upload-Metadata": uploadMetadata(file),
    },
  });

  const location = createResponse.headers.get("location");

  if (!createResponse.ok || !location) {
    throw new Error(`Cloudflare upload session failed with status ${createResponse.status}.`);
  }

  const patchUrl = new URL(location, uploadUrl).toString();
  const uploadResponse = await fetch(patchUrl, {
    method: "PATCH",
    headers: {
      "Tus-Resumable": "1.0.0",
      "Upload-Offset": "0",
      "Content-Type": "application/offset+octet-stream",
    },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error(`Cloudflare upload failed with status ${uploadResponse.status}.`);
  }
}

function uploadMetadata(file: File) {
  const metadata = [
    ["filename", file.name],
    ["filetype", file.type || "application/octet-stream"],
  ];

  return metadata.map(([key, value]) => `${key} ${toBase64(value)}`).join(",");
}

function toBase64(value: string) {
  return btoa(unescape(encodeURIComponent(value)));
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function statusLabel(status: VideoStatus) {
  if (status === "READY") return "Ready";
  if (status === "FAILED") return "Failed";
  if (status === "PROCESSING") return "Processing";
  return "Uploading";
}

function statusClassName(status: VideoStatus) {
  const base = "rounded-full px-2 py-1 text-xs font-black";

  if (status === "READY") return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200`;
  if (status === "FAILED") return `${base} bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-200`;
  if (status === "PROCESSING") return `${base} bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200`;
  return `${base} bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200`;
}
