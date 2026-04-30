"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";

type VideoShareButtonProps = {
  videoId: string;
  canShare: boolean;
};

type ShareResponse = {
  shareUrl?: string;
  error?: string;
};

export function VideoShareButton({ videoId, canShare }: VideoShareButtonProps) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createShareLink() {
    if (!canShare || isCreating) return;

    setIsCreating(true);
    setError(null);

    const response = await apiFetch(`/api/videos/${videoId}/share`, { method: "POST" });
    const body = (await response.json().catch(() => ({}))) as ShareResponse;

    if (!response.ok || !body.shareUrl) {
      setError(body.error ?? "Unable to create share link.");
      setIsCreating(false);
      return;
    }

    setShareUrl(body.shareUrl);
    setIsCreating(false);
  }

  if (!canShare) {
    return null;
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={createShareLink}
        disabled={isCreating}
        className="min-h-11 w-full rounded-lg bg-slate-950 px-4 py-2 text-sm font-black text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 dark:disabled:bg-slate-700 dark:disabled:text-slate-300 sm:w-auto"
      >
        {isCreating ? "Creating link..." : "Create customer link"}
      </button>

      {shareUrl ? (
        <div className="max-w-full rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-900 dark:bg-emerald-950/40">
          <p className="font-bold text-emerald-800 dark:text-emerald-200">Customer link</p>
          <a href={shareUrl} className="mt-1 block break-all text-emerald-700 underline dark:text-emerald-200">
            {shareUrl}
          </a>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}
    </div>
  );
}
