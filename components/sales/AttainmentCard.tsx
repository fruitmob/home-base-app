import { formatCurrency } from "@/lib/core/money";

type AttainmentRow = {
  id: string;
  label: string;
  period: string;
  targetAmount: number;
  attainmentAmount: number;
  attainmentPercent: number;
};

export function AttainmentCard({
  title,
  rows,
}: {
  title: string;
  rows: AttainmentRow[];
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-black uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
        Goals
      </p>
      <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white">
        {title}
      </h3>

      <div className="mt-6 space-y-4">
        {rows.map((row) => (
          <div key={row.id} className="space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-bold text-slate-950 dark:text-white">{row.label}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{row.period}</p>
              </div>
              <p className="text-right text-sm font-bold text-slate-700 dark:text-slate-200">
                {row.attainmentPercent}%
              </p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-green-600 dark:bg-green-400"
                style={{ width: `${Math.min(row.attainmentPercent, 100)}%` }}
              />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {formatCurrency(row.attainmentAmount)} won of {formatCurrency(row.targetAmount)}
            </p>
          </div>
        ))}
        {rows.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
            No goals set for this view yet.
          </p>
        ) : null}
      </div>
    </section>
  );
}
