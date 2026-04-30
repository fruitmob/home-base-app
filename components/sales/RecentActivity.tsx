import Link from "next/link";

type RecentActivityRow = {
  id: string;
  type: string;
  subject: string;
  createdAt: string;
  ownerEmail: string | null;
  href: string;
  parentLabel: string;
};

export function RecentActivity({ rows }: { rows: RecentActivityRow[] }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-black uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
        Activity
      </p>
      <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white">
        Recent Touches
      </h3>

      <div className="mt-6 divide-y divide-slate-200 dark:divide-slate-800">
        {rows.map((row) => (
          <Link
            key={row.id}
            href={row.href}
            className="block py-4 transition hover:bg-slate-50 dark:hover:bg-slate-800/40"
          >
            <div className="flex flex-col gap-1 px-2">
              <div className="flex items-center justify-between gap-4">
                <p className="font-bold text-slate-950 dark:text-white">{row.subject}</p>
                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {row.type}
                </span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">{row.parentLabel}</p>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {row.ownerEmail ?? "Unassigned"} | {new Date(row.createdAt).toLocaleDateString()}
              </p>
            </div>
          </Link>
        ))}
        {rows.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
            No recent sales activity yet.
          </p>
        ) : null}
      </div>
    </section>
  );
}
