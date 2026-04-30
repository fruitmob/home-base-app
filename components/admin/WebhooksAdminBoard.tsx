"use client";

import { useCallback, useState } from "react";
import { apiFetch } from "@/lib/api";
import type {
  WebhookDeliverySummary,
  WebhookEndpointSummary,
} from "@/lib/webhooks/admin";

type EventCatalogEntry = {
  type: string;
  label: string;
  description: string;
};

type WebhooksAdminBoardProps = {
  initialEndpoints: WebhookEndpointSummary[];
  initialDeliveries: WebhookDeliverySummary[];
  eventCatalog: EventCatalogEntry[];
};

type CreateFormState = {
  label: string;
  url: string;
  eventTypes: Set<string>;
};

export function WebhooksAdminBoard({
  initialEndpoints,
  initialDeliveries,
  eventCatalog,
}: WebhooksAdminBoardProps) {
  const [endpoints, setEndpoints] = useState(initialEndpoints);
  const [deliveries, setDeliveries] = useState(initialDeliveries);
  const [createState, setCreateState] = useState<CreateFormState>({
    label: "",
    url: "",
    eventTypes: new Set<string>(),
  });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const response = await apiFetch("/api/admin/webhooks");
    if (!response.ok) return;
    const data = (await response.json()) as {
      endpoints: WebhookEndpointSummary[];
      deliveries: WebhookDeliverySummary[];
    };
    setEndpoints(data.endpoints);
    setDeliveries(data.deliveries);
  }, []);

  const createEndpoint = useCallback(async () => {
    setError(null);
    setNotice(null);
    setPendingId("__new__");

    const eventTypes = Array.from(createState.eventTypes);
    const response = await apiFetch("/api/admin/webhooks", {
      method: "POST",
      body: JSON.stringify({
        label: createState.label,
        url: createState.url,
        eventTypes,
      }),
    });

    setPendingId(null);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "Failed to create endpoint.");
      return;
    }

    const data = (await response.json()) as {
      endpoint: WebhookEndpointSummary;
      secret: string;
    };
    setCreateState({ label: "", url: "", eventTypes: new Set() });
    setNotice(
      `Endpoint ${data.endpoint.label} saved. Signing secret (copy now, it will not be shown again): ${data.secret}`,
    );
    await refresh();
  }, [createState, refresh]);

  const patchEndpoint = useCallback(
    async (id: string, body: Record<string, unknown>, confirmMessage?: string) => {
      if (confirmMessage && !window.confirm(confirmMessage)) return;
      setError(null);
      setNotice(null);
      setPendingId(id);
      const response = await apiFetch(`/api/admin/webhooks/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setPendingId(null);
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error ?? "Failed to update endpoint.");
        return;
      }
      const data = (await response.json()) as {
        endpoint: WebhookEndpointSummary;
        secret: string | null;
      };
      if (data.secret) {
        setNotice(
          `New signing secret for ${data.endpoint.label} (copy now, it will not be shown again): ${data.secret}`,
        );
      }
      await refresh();
    },
    [refresh],
  );

  const deleteEndpoint = useCallback(
    async (id: string, label: string) => {
      if (!window.confirm(`Remove endpoint "${label}"? Pending deliveries for it will stop.`)) return;
      setError(null);
      setNotice(null);
      setPendingId(id);
      const response = await apiFetch(`/api/admin/webhooks/${id}`, { method: "DELETE" });
      setPendingId(null);
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error ?? "Failed to remove endpoint.");
        return;
      }
      setNotice(`Endpoint "${label}" removed.`);
      await refresh();
    },
    [refresh],
  );

  const processPending = useCallback(async () => {
    setError(null);
    setNotice(null);
    setPendingId("__queue__");
    const response = await apiFetch("/api/admin/webhooks/process-pending", { method: "POST" });
    setPendingId(null);
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "Failed to run delivery queue.");
      return;
    }
    const data = (await response.json()) as { processed: number };
    setNotice(`Processed ${data.processed} pending ${data.processed === 1 ? "delivery" : "deliveries"}.`);
    await refresh();
  }, [refresh]);

  function toggleCreateEvent(type: string) {
    setCreateState((prev) => {
      const next = new Set(prev.eventTypes);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return { ...prev, eventTypes: next };
    });
  }

  return (
    <div className="space-y-6">
      {notice ? <Banner tone="info">{notice}</Banner> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5 dark:border-slate-800">
            <div>
              <h3 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
                Endpoints
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {endpoints.length} configured. Disable an endpoint to pause outbound deliveries without
                losing its history.
              </p>
            </div>
            <button
              type="button"
              onClick={processPending}
              disabled={pendingId !== null}
              className="rounded-full bg-slate-950 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
            >
              {pendingId === "__queue__" ? "Running..." : "Run delivery queue"}
            </button>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {endpoints.length === 0 ? (
              <p className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400">
                No endpoints yet. Use the form to add the first one.
              </p>
            ) : (
              endpoints.map((endpoint) => (
                <EndpointRow
                  key={endpoint.id}
                  endpoint={endpoint}
                  eventCatalog={eventCatalog}
                  busy={pendingId === endpoint.id}
                  onToggle={(enabled) => patchEndpoint(endpoint.id, { enabled })}
                  onRotate={() =>
                    patchEndpoint(
                      endpoint.id,
                      { rotateSecret: true },
                      "Rotate the signing secret? The previous one stops working immediately.",
                    )
                  }
                  onUpdateEvents={(eventTypes) => patchEndpoint(endpoint.id, { eventTypes })}
                  onDelete={() => deleteEndpoint(endpoint.id, endpoint.label)}
                />
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
            <h3 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
              Add endpoint
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Home Base signs each delivery with the secret you receive here once — store it in your
              integration before closing the confirmation.
            </p>
          </div>
          <div className="space-y-4 px-6 py-5">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
              Label
              <input
                type="text"
                value={createState.label}
                onChange={(event) =>
                  setCreateState((prev) => ({ ...prev, label: event.target.value }))
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                placeholder="Acme ERP bridge"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
              URL
              <input
                type="url"
                value={createState.url}
                onChange={(event) =>
                  setCreateState((prev) => ({ ...prev, url: event.target.value }))
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                placeholder="https://hooks.example.com/homebase"
              />
            </label>
            <fieldset>
              <legend className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Event types
              </legend>
              <div className="mt-2 space-y-2">
                {eventCatalog.map((entry) => (
                  <label
                    key={entry.type}
                    className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950"
                  >
                    <input
                      type="checkbox"
                      checked={createState.eventTypes.has(entry.type)}
                      onChange={() => toggleCreateEvent(entry.type)}
                      className="mt-1"
                    />
                    <span>
                      <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                        {entry.type}
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
              onClick={createEndpoint}
              disabled={pendingId !== null}
              className="w-full rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
            >
              {pendingId === "__new__" ? "Saving..." : "Create endpoint"}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
          <h3 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
            Recent deliveries
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Last 50 attempts, newest first.
          </p>
        </div>
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {deliveries.length === 0 ? (
            <p className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400">
              No deliveries have been attempted yet.
            </p>
          ) : (
            deliveries.map((delivery) => <DeliveryRow key={delivery.id} delivery={delivery} />)
          )}
        </div>
      </div>
    </div>
  );
}

function EndpointRow({
  endpoint,
  eventCatalog,
  busy,
  onToggle,
  onRotate,
  onUpdateEvents,
  onDelete,
}: {
  endpoint: WebhookEndpointSummary;
  eventCatalog: EventCatalogEntry[];
  busy: boolean;
  onToggle: (enabled: boolean) => void;
  onRotate: () => void;
  onUpdateEvents: (eventTypes: string[]) => void;
  onDelete: () => void;
}) {
  function handleToggle(event: React.ChangeEvent<HTMLInputElement>) {
    const next = new Set(endpoint.eventTypes);
    if (event.target.checked) next.add(event.target.value);
    else next.delete(event.target.value);
    onUpdateEvents(Array.from(next));
  }

  return (
    <div className="px-6 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-950 dark:text-white">{endpoint.label}</p>
          <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">
            {endpoint.url}
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Secret ends in <span className="font-mono">…{endpoint.secretPreview}</span> | Updated{" "}
            {formatTimestamp(endpoint.updatedAt)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge enabled={endpoint.enabled} />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onToggle(!endpoint.enabled)}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {endpoint.enabled ? "Disable" : "Enable"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onRotate}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Rotate secret
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onDelete}
              className="rounded-full border border-rose-200 px-3 py-1 text-xs font-bold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60 dark:border-rose-900/60 dark:text-rose-400 dark:hover:bg-rose-900/30"
            >
              Remove
            </button>
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {eventCatalog.map((entry) => {
          const checked = endpoint.eventTypes.includes(entry.type);
          return (
            <label
              key={`${endpoint.id}-${entry.type}`}
              className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                checked
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-900/30 dark:text-emerald-300"
                  : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400"
              }`}
            >
              <input
                type="checkbox"
                value={entry.type}
                checked={checked}
                disabled={busy}
                onChange={handleToggle}
                className="h-3 w-3"
              />
              <span className="font-mono">{entry.type}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function DeliveryRow({ delivery }: { delivery: WebhookDeliverySummary }) {
  return (
    <div className="px-6 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-950 dark:text-white">{delivery.endpointLabel}</p>
          <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">
            {delivery.eventType} | event {delivery.eventId.slice(0, 8)}
          </p>
          {delivery.errorMessage ? (
            <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{delivery.errorMessage}</p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-1 text-xs text-slate-500 dark:text-slate-400">
          <DeliveryStatusBadge status={delivery.status} />
          <span>
            Attempts {delivery.attemptCount}/{delivery.maxAttempts}
            {delivery.responseStatus ? ` | HTTP ${delivery.responseStatus}` : ""}
          </span>
          <span>
            Next {delivery.status === "SUCCEEDED" ? "—" : formatTimestamp(delivery.nextAttemptAt)}
          </span>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ${
        enabled
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
          : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
      }`}
    >
      {enabled ? "Enabled" : "Disabled"}
    </span>
  );
}

function DeliveryStatusBadge({ status }: { status: string }) {
  const base = "rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.18em]";
  switch (status) {
    case "SUCCEEDED":
      return <span className={`${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300`}>Succeeded</span>;
    case "FAILED":
      return <span className={`${base} bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300`}>Retrying</span>;
    case "PERMANENTLY_FAILED":
      return <span className={`${base} bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300`}>Gave up</span>;
    case "PENDING":
    default:
      return <span className={`${base} bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200`}>Pending</span>;
  }
}

function Banner({ tone, children }: { tone: "info" | "error"; children: React.ReactNode }) {
  const className =
    tone === "error"
      ? "rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300"
      : "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300";
  return <div className={className}>{children}</div>;
}

function formatTimestamp(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
