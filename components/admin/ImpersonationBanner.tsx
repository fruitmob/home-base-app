"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

type Props = {
  actorEmail: string;
  targetEmail: string;
  targetRole: string;
  reason: string;
};

export function ImpersonationBanner({ targetEmail, targetRole, reason }: Props) {
  const router = useRouter();
  const [stopping, setStopping] = useState(false);

  async function handleStop() {
    setStopping(true);
    try {
      const res = await apiFetch("/api/admin/impersonation", { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      router.push("/admin");
      router.refresh();
    } catch {
      setStopping(false);
      alert("Failed to stop impersonation. Try refreshing the page.");
    }
  }

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-4 bg-amber-400 px-5 py-2.5 text-sm font-semibold text-amber-950 dark:bg-amber-500 dark:text-amber-950 sm:px-8">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <span className="shrink-0 rounded-full bg-amber-950/15 px-2.5 py-0.5 text-xs font-bold uppercase tracking-[0.18em]">
          Impersonating
        </span>
        <span className="truncate">
          Viewing as <strong>{targetEmail}</strong> ({targetRole.replaceAll("_", " ")})
        </span>
        <span className="hidden text-amber-800 sm:inline">·</span>
        <span className="hidden truncate text-amber-800 sm:inline">
          Reason: {reason}
        </span>
      </div>
      <button
        onClick={handleStop}
        disabled={stopping}
        className="shrink-0 rounded-full bg-amber-950 px-3 py-1 text-xs font-bold text-amber-50 transition hover:bg-amber-800 disabled:opacity-60"
      >
        {stopping ? "Stopping…" : "Stop"}
      </button>
    </div>
  );
}
