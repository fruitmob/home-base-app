"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";

type Flag = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  enabled: boolean;
};

type Props = {
  initialFlags: Flag[];
  isOwner: boolean;
};

export function AdminFlagManager({ initialFlags, isOwner }: Props) {
  const [flags, setFlags] = useState(initialFlags);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newEnabled, setNewEnabled] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleToggle(flag: Flag) {
    setToggling(flag.id);
    try {
      const res = await apiFetch(`/api/admin/flags/${flag.id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !flag.enabled }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { flag: Flag };
      setFlags((prev) => prev.map((f) => (f.id === data.flag.id ? data.flag : f)));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update flag.");
    } finally {
      setToggling(null);
    }
  }

  async function handleDelete(flag: Flag) {
    if (!confirm(`Delete flag "${flag.key}"? This cannot be undone.`)) return;
    setDeleting(flag.id);
    try {
      const res = await apiFetch(`/api/admin/flags/${flag.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      setFlags((prev) => prev.filter((f) => f.id !== flag.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete flag.");
    } finally {
      setDeleting(null);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError("");
    try {
      const res = await apiFetch("/api/admin/flags", {
        method: "POST",
        body: JSON.stringify({
          key: newKey.trim(),
          label: newLabel.trim(),
          description: newDesc.trim() || undefined,
          enabled: newEnabled,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { flag: Flag };
      setFlags((prev) =>
        [...prev, data.flag].sort(
          (a, b) => Number(b.enabled) - Number(a.enabled) || a.key.localeCompare(b.key),
        ),
      );
      setNewKey("");
      setNewLabel("");
      setNewDesc("");
      setNewEnabled(false);
      setShowCreate(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create flag.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5 dark:border-slate-800">
          <div>
            <h3 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
              All Feature Flags
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {flags.length === 0
                ? "No flags defined yet."
                : `${flags.length} flag${flags.length === 1 ? "" : "s"} — enabled flags show in the product.`}
            </p>
          </div>
          {isOwner && (
            <button
              onClick={() => setShowCreate((v) => !v)}
              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
            >
              {showCreate ? "Cancel" : "New flag"}
            </button>
          )}
        </div>

        {showCreate && (
          <form
            onSubmit={handleCreate}
            className="border-b border-slate-200 bg-slate-50 px-6 py-6 dark:border-slate-800 dark:bg-slate-800/50"
          >
            <h4 className="font-bold text-slate-950 dark:text-white">Create flag</h4>
            {createError && (
              <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{createError}</p>
            )}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Key
                </label>
                <input
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  placeholder="nav.training"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  required
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Lowercase, dots, underscores only.
                </p>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Label
                </label>
                <input
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  placeholder="Training Module"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Description
                </label>
                <input
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  placeholder="Optional — visible in the admin panel only."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={newEnabled}
                  onClick={() => setNewEnabled((v) => !v)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 ${
                    newEnabled ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      newEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
                <span className="text-sm text-slate-700 dark:text-slate-200">
                  {newEnabled ? "Enabled on creation" : "Disabled on creation"}
                </span>
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                type="submit"
                disabled={creating}
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-60 dark:bg-white dark:text-slate-950"
              >
                {creating ? "Creating…" : "Create flag"}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {flags.length === 0 ? (
          <p className="px-6 py-10 text-sm text-slate-500 dark:text-slate-400">
            No feature flags yet. Create one above to start controlling surface visibility.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {flags.map((flag) => (
              <div key={flag.id} className="flex items-center gap-4 px-6 py-4">
                <button
                  role="switch"
                  aria-checked={flag.enabled}
                  aria-label={`Toggle ${flag.label}`}
                  disabled={!isOwner || toggling === flag.id}
                  onClick={() => handleToggle(flag)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                    flag.enabled ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      flag.enabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-slate-950 dark:text-white">
                      {flag.key}
                    </span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      {flag.label}
                    </span>
                  </div>
                  {flag.description && (
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {flag.description}
                    </p>
                  )}
                </div>

                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    flag.enabled
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                >
                  {flag.enabled ? "on" : "off"}
                </span>

                {isOwner && (
                  <button
                    onClick={() => handleDelete(flag)}
                    disabled={deleting === flag.id}
                    className="shrink-0 text-xs text-slate-400 underline-offset-2 hover:text-rose-600 hover:underline disabled:opacity-60 dark:text-slate-500 dark:hover:text-rose-400"
                  >
                    {deleting === flag.id ? "Removing…" : "Remove"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-slate-50 px-6 py-5 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
        <p className="font-semibold text-slate-950 dark:text-white">How flags work</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>
            Flags are checked by key (e.g. <code className="font-mono text-xs">nav.training</code>).
          </li>
          <li>When a flag is <strong>off</strong>, the wired surface hides itself.</li>
          <li>When a flag is <strong>on</strong>, the surface is visible.</li>
          <li>Surfaces with no flag wired are always visible regardless of this list.</li>
        </ul>
      </div>
    </div>
  );
}
