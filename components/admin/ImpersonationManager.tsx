"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

type ImpersonatableUser = {
  id: string;
  email: string;
  role: string;
};

type SerializedActiveImpersonation = {
  id: string;
  targetEmail: string;
  targetRole: string;
  reason: string;
};

type Props = {
  impersonatableUsers: ImpersonatableUser[];
  activeImpersonation: SerializedActiveImpersonation | null;
};

export function ImpersonationManager({ impersonatableUsers, activeImpersonation }: Props) {
  const router = useRouter();
  const [selectedUserId, setSelectedUserId] = useState("");
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    if (!selectedUserId || !reason.trim()) return;
    setWorking(true);
    setError(null);
    try {
      const res = await apiFetch("/api/admin/impersonation", {
        method: "POST",
        body: JSON.stringify({ targetUserId: selectedUserId, reason }),
      });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start impersonation.");
      setWorking(false);
    }
  }

  async function handleStop() {
    setWorking(true);
    setError(null);
    try {
      const res = await apiFetch("/api/admin/impersonation", { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to stop impersonation.");
      setWorking(false);
    }
  }

  if (activeImpersonation) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-700/50 dark:bg-amber-950/20">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
              Active Session
            </p>
            <p className="mt-2 text-xl font-black text-slate-950 dark:text-white">
              {activeImpersonation.targetEmail}
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {activeImpersonation.targetRole.replaceAll("_", " ")} &middot; Reason:{" "}
              {activeImpersonation.reason}
            </p>
          </div>
          <button
            onClick={handleStop}
            disabled={working}
            className="shrink-0 rounded-full bg-amber-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-amber-700 disabled:opacity-60"
          >
            {working ? "Stopping…" : "Stop impersonating"}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h3 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
        Start impersonation
      </h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        View the platform exactly as another user sees it. Your owner credentials remain active — all
        mutations audit under your account.
      </p>
      <div className="mt-5 space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            User
          </label>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:ring-white"
          >
            <option value="">— Select a user —</option>
            {impersonatableUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email} ({u.role.replaceAll("_", " ")})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Reason
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Reproducing work order display issue reported by user"
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-950 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:ring-white"
          />
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button
          onClick={handleStart}
          disabled={working || !selectedUserId || !reason.trim()}
          className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
        >
          {working ? "Starting…" : "Start impersonating"}
        </button>
      </div>
    </div>
  );
}
