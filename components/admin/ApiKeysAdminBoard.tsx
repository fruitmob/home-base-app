"use client";

import { useCallback, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { ApiKeySummary } from "@/lib/api-keys/admin";

type ScopeCatalogEntry = {
  scope: string;
  label: string;
  description: string;
};

type ApiKeysAdminBoardProps = {
  initialKeys: ApiKeySummary[];
  scopeCatalog: ScopeCatalogEntry[];
};

type CreateFormState = {
  label: string;
  scopes: Set<string>;
};

export function ApiKeysAdminBoard({ initialKeys, scopeCatalog }: ApiKeysAdminBoardProps) {
  const [keys, setKeys] = useState<ApiKeySummary[]>(initialKeys);
  const [form, setForm] = useState<CreateFormState>({
    label: "",
    scopes: new Set<string>(),
  });
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const response = await apiFetch("/api/admin/api-keys");
    if (!response.ok) return;
    const data = (await response.json()) as { keys: ApiKeySummary[] };
    setKeys(data.keys);
  }, []);

  const issueKey = useCallback(async () => {
    setError(null);
    setNotice(null);
    setPlaintext(null);
    setPendingId("__new__");

    const response = await apiFetch("/api/admin/api-keys", {
      method: "POST",
      body: JSON.stringify({
        label: form.label,
        scopes: Array.from(form.scopes),
      }),
    });
    setPendingId(null);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "Failed to issue API key.");
      return;
    }

    const data = (await response.json()) as { key: ApiKeySummary; plaintext: string };
    setForm({ label: "", scopes: new Set() });
    setPlaintext(data.plaintext);
    setNotice(`Key "${data.key.label}" issued. Copy the value below — it will not be shown again.`);
    await refresh();
  }, [form, refresh]);

  const revokeKey = useCallback(
    async (id: string, label: string) => {
      if (!window.confirm(`Revoke API key "${label}"? It stops working immediately.`)) return;
      setError(null);
      setNotice(null);
      setPendingId(id);
      const response = await apiFetch(`/api/admin/api-keys/${id}`, { method: "DELETE" });
      setPendingId(null);
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error ?? "Failed to revoke API key.");
        return;
      }
      setNotice(`Key "${label}" revoked.`);
      await refresh();
    },
    [refresh],
  );

  function toggleScope(scope: string) {
    setForm((prev) => {
      const next = new Set(prev.scopes);
      if (next.has(scope)) next.delete(scope);
      else next.add(scope);
      return { ...prev, scopes: next };
    });
  }

  return (
    <div className="space-y-6">
      {plaintext ? (
        <div className="rounded-3xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-900/60 dark:bg-amber-950/30">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-800 dark:text-amber-300">
            Copy this key now
          </p>
          <p className="mt-2 break-all rounded-xl bg-white p-3 font-mono text-sm text-slate-900 dark:bg-slate-950 dark:text-white">
            {plaintext}
          </p>
          <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
            Home Base stores only the hash. Close this banner after you save the key in your
            integration&apos;s secret store.
          </p>
          <button
            type="button"
            onClick={() => setPlaintext(null)}
            className="mt-3 rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-bold text-amber-900 transition hover:bg-amber-100 dark:border-amber-900/60 dark:bg-slate-950 dark:text-amber-200 dark:hover:bg-slate-900"
          >
            I saved it
          </button>
        </div>
      ) : null}
      {notice ? <Banner tone="info">{notice}</Banner> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
            <h3 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
              Issued keys
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {keys.length} on record. Revoking a key is immediate and cannot be undone.
            </p>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {keys.length === 0 ? (
              <p className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400">
                No keys issued yet. Use the form to issue the first one.
              </p>
            ) : (
              keys.map((key) => (
                <KeyRow
                  key={key.id}
                  apiKey={key}
                  busy={pendingId === key.id}
                  onRevoke={() => revokeKey(key.id, key.label)}
                />
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
            <h3 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
              Issue new key
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Name the integration and pick its allowed scopes. You can always narrow scope by
              revoking and issuing a replacement.
            </p>
          </div>
          <div className="space-y-4 px-6 py-5">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
              Label
              <input
                type="text"
                value={form.label}
                onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))}
                placeholder="Acme ERP read-only"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </label>
            <fieldset>
              <legend className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Scopes
              </legend>
              <div className="mt-2 space-y-2">
                {scopeCatalog.map((entry) => (
                  <label
                    key={entry.scope}
                    className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950"
                  >
                    <input
                      type="checkbox"
                      checked={form.scopes.has(entry.scope)}
                      onChange={() => toggleScope(entry.scope)}
                      className="mt-1"
                    />
                    <span>
                      <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                        {entry.scope}
                      </span>
                      <br />
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">
                        {entry.label}
                      </span>
                      <br />
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {entry.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <button
              type="button"
              onClick={issueKey}
              disabled={pendingId !== null}
              className="w-full rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
            >
              {pendingId === "__new__" ? "Issuing..." : "Issue key"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function KeyRow({
  apiKey,
  busy,
  onRevoke,
}: {
  apiKey: ApiKeySummary;
  busy: boolean;
  onRevoke: () => void;
}) {
  const revoked = Boolean(apiKey.revokedAt);
  return (
    <div className="px-6 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-950 dark:text-white">{apiKey.label}</p>
          <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">
            hbk_…{apiKey.lastFour}
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Issued {formatTimestamp(apiKey.createdAt)}
            {apiKey.lastUsedAt ? ` | last used ${formatTimestamp(apiKey.lastUsedAt)}` : " | never used"}
            {revoked ? ` | revoked ${formatTimestamp(apiKey.revokedAt as Date)}` : ""}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {apiKey.scopes.map((scope) => (
              <span
                key={`${apiKey.id}-${scope}`}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-mono text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
              >
                {scope}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge revoked={revoked} />
          {revoked ? null : (
            <button
              type="button"
              disabled={busy}
              onClick={onRevoke}
              className="rounded-full border border-rose-200 px-3 py-1 text-xs font-bold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60 dark:border-rose-900/60 dark:text-rose-400 dark:hover:bg-rose-900/30"
            >
              Revoke
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ revoked }: { revoked: boolean }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ${
        revoked
          ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
      }`}
    >
      {revoked ? "Revoked" : "Active"}
    </span>
  );
}

function Banner({ tone, children }: { tone: "info" | "error"; children: React.ReactNode }) {
  const className =
    tone === "error"
      ? "rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300"
      : "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300";
  return <div className={className}>{children}</div>;
}

function formatTimestamp(value: Date | string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
