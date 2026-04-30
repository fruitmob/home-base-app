import Link from "next/link";
import type { DashboardSnapshot } from "@/lib/reports/dashboard";

export function DashboardHome({ snapshot }: { snapshot: DashboardSnapshot }) {
  return (
    <section className="mx-auto max-w-7xl space-y-8">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="bg-[radial-gradient(circle_at_top_right,_#f59e0b,_transparent_26%),linear-gradient(135deg,_#fff7ed_0%,_#e2e8f0_100%)] px-8 py-10 dark:bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.32),_transparent_26%),linear-gradient(135deg,_#111827_0%,_#020617_100%)]">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">
            {snapshot.eyebrow}
          </p>
          <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="max-w-4xl text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">
                {snapshot.title}
              </h2>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300">
                {snapshot.description}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {snapshot.actions.map((action) => (
                <Link
                  key={`${action.href}-${action.label}`}
                  href={action.href}
                  className={action.variant === "primary"
                    ? "rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                    : "rounded-full border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"}
                >
                  {action.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {snapshot.metrics.map((metric) => (
              <MetricCard
                key={metric.label}
                label={metric.label}
                value={metric.value}
                detail={metric.detail}
                href={metric.href}
              />
            ))}
          </div>
        </div>
      </div>

      <div className={`grid gap-6 ${snapshot.sections.length > 1 ? "xl:grid-cols-2" : ""}`}>
        {snapshot.sections.map((section) => (
          <div
            key={section.title}
            className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
              <h3 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
                {section.title}
              </h3>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{section.description}</p>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {section.items.length === 0 ? (
                <p className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400">
                  {section.emptyMessage}
                </p>
              ) : (
                section.items.map((item) => <SectionRow key={`${section.title}-${item.label}-${item.value}`} {...item} />)
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  detail,
  href,
}: {
  label: string;
  value: string;
  detail: string;
  href?: string;
}) {
  const inner = (
    <>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-3 text-3xl font-black tracking-tight text-slate-950 dark:text-white">
        {value}
      </p>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{detail}</p>
    </>
  );

  if (!href) {
    return (
      <div className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-sm transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/80 dark:hover:border-slate-500"
    >
      {inner}
    </Link>
  );
}

function SectionRow({
  label,
  value,
  detail,
  href,
}: {
  label: string;
  value: string;
  detail: string;
  href?: string;
}) {
  const inner = (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-950 dark:text-white">{label}</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{detail}</p>
      </div>
      <p className="text-right text-sm font-black uppercase tracking-[0.14em] text-slate-700 dark:text-slate-200">
        {value}
      </p>
    </div>
  );

  if (!href) {
    return <div className="px-6 py-4">{inner}</div>;
  }

  return (
    <Link
      href={href}
      className="block px-6 py-4 transition hover:bg-slate-50 dark:hover:bg-slate-950/70"
    >
      {inner}
    </Link>
  );
}
