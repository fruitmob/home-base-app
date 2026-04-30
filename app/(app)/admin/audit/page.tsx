import { listAdminAuditActions, listAdminAuditActors, listAdminAuditEntries, listAdminAuditEntityTypes } from "@/lib/admin/audit";
import { requireAdminPageUser } from "@/lib/core/pageAuth";

type AdminAuditPageProps = {
  searchParams?: {
    q?: string;
    actorUserId?: string;
    entityType?: string;
    action?: string;
    from?: string;
    to?: string;
  };
};

export default async function AdminAuditPage({ searchParams }: AdminAuditPageProps) {
  await requireAdminPageUser();

  const query = searchParams?.q?.trim() ?? "";
  const actorUserId = searchParams?.actorUserId?.trim() ?? "";
  const entityType = searchParams?.entityType?.trim() ?? "";
  const action = searchParams?.action?.trim() ?? "";
  const from = searchParams?.from?.trim() ?? "";
  const to = searchParams?.to?.trim() ?? "";

  const [entries, actors, entityTypes, actions] = await Promise.all([
    listAdminAuditEntries({
      query,
      actorUserId: actorUserId || undefined,
      entityType: entityType || undefined,
      action: action || undefined,
      from: from || undefined,
      to: to || undefined,
      take: 150,
    }),
    listAdminAuditActors(),
    listAdminAuditEntityTypes(),
    listAdminAuditActions(),
  ]);

  return (
    <section className="mx-auto max-w-7xl space-y-8">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="bg-[radial-gradient(circle_at_top_right,_#86efac,_transparent_30%),linear-gradient(135deg,_#f0fdf4_0%,_#e2e8f0_100%)] px-8 py-10 dark:bg-[radial-gradient(circle_at_top_right,_rgba(34,197,94,0.3),_transparent_30%),linear-gradient(135deg,_#052e16_0%,_#020617_100%)]">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">
            Admin Tools
          </p>
          <h2 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">
            Audit Trail
          </h2>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
            Search who changed what, when it happened, and which record was involved.
          </p>
        </div>
      </div>

      <form className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-2 xl:grid-cols-[1fr_220px_220px_260px_260px_auto]">
        <label>
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Search
          </span>
          <input
            name="q"
            defaultValue={query}
            placeholder="Action, entity, record, or actor"
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-slate-800"
          />
        </label>
        <label>
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Actor
          </span>
          <select
            name="actorUserId"
            defaultValue={actorUserId}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-slate-800"
          >
            <option value="">Everyone</option>
            {actors.map((actor) => (
              <option key={actor.id} value={actor.id}>
                {actor.email}
                {actor.deletedAt ? " (disabled)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Entity
          </span>
          <select
            name="entityType"
            defaultValue={entityType}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-slate-800"
          >
            <option value="">All entities</option>
            {entityTypes.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Action
          </span>
          <select
            name="action"
            defaultValue={action}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-slate-800"
          >
            <option value="">All actions</option>
            {actions.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            From
          </span>
          <input
            name="from"
            type="datetime-local"
            defaultValue={from}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-slate-800"
          />
        </label>
        <label>
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            To
          </span>
          <input
            name="to"
            type="datetime-local"
            defaultValue={to}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-slate-800"
          />
        </label>
        <div className="flex items-end md:col-span-2 xl:col-span-1">
          <button
            type="submit"
            className="w-full rounded-full border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Apply filters
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
          <thead className="bg-slate-50 dark:bg-slate-950">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                Time
              </th>
              <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                Actor
              </th>
              <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                Action
              </th>
              <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                Record
              </th>
              <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                Details
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  No audit entries match those filters.
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id} className="align-top hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                    {formatTimestamp(entry.createdAt)}
                  </td>
                  <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                    <p>{entry.actorUser?.email ?? "System"}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {entry.ipAddress ?? "No IP"}
                    </p>
                  </td>
                  <td className="px-5 py-4 font-semibold text-slate-950 dark:text-white">
                    {entry.action}
                  </td>
                  <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                    <p>{entry.entityType}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {entry.entityId ?? "No record id"}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-500 dark:text-slate-400">
                    {summarizeAuditPayload(entry.beforeJson, entry.afterJson)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatTimestamp(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function summarizeAuditPayload(before: unknown, after: unknown) {
  if (after != null) {
    return truncateJson(after);
  }

  if (before != null) {
    return truncateJson(before);
  }

  return "No payload captured";
}

function truncateJson(value: unknown) {
  const text = JSON.stringify(value);
  return text.length > 140 ? `${text.slice(0, 137)}...` : text;
}
