import Link from "next/link";
import type { DashboardMetric, DashboardRow } from "@/lib/reports/dashboard";
import type { PartsInventoryReport } from "@/lib/reports/parts";

export function PartsInventoryReportView({ report }: { report: PartsInventoryReport }) {
  return (
    <section className="mx-auto max-w-7xl space-y-8">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="bg-[radial-gradient(circle_at_top_right,_#6366f1,_transparent_24%),linear-gradient(135deg,_#eef2ff_0%,_#ecfeff_100%)] px-8 py-10 dark:bg-[radial-gradient(circle_at_top_right,_rgba(99,102,241,0.28),_transparent_24%),linear-gradient(135deg,_#111827_0%,_#020617_100%)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">
                Parts Reports
              </p>
              <h2 className="mt-4 max-w-4xl text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">
                {report.title}
              </h2>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300">
                {report.description}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/reports"
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Back to reports hub
              </Link>
              <a
                href="/api/reports/parts/export"
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Download CSV
              </a>
              <Link
                href="/parts"
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
              >
                Open parts
              </Link>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {report.heroMetrics.map((metric) => (
              <MetricCard key={metric.label} metric={metric} />
            ))}
          </div>
        </div>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
          Report Windows
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {report.windows.map((window) => (
            <div
              key={window.label}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"
            >
              <p className="text-sm font-black text-slate-950 dark:text-white">{window.label}</p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{window.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <ReportSection
        id="low-stock"
        eyebrow="Shortages"
        title="Low stock watchlist"
        description="Active parts that are already at or below their reorder point, sorted by the biggest shortfall first."
        metrics={report.lowStockMetrics}
        callout="Low stock compares current on-hand against the reorder point stored on the part. Parts with a reorder point of zero are intentionally excluded so items without a tracked reorder rule do not flood the list."
        columns={[
          {
            title: "Parts under reorder",
            description: "Biggest shortfall first. Click a row to open the part.",
            rows: report.lowStockRows,
            emptyMessage: "No active parts are below their reorder point right now.",
          },
        ]}
      />

      <ReportSection
        id="turn"
        eyebrow="Velocity"
        title="What is actually moving"
        description="Units issued from stock in the velocity window, top parts first, with a rough coverage-days estimate for the current on-hand."
        metrics={report.turnMetrics}
        callout="Velocity uses ISSUE transactions only. Coverage estimate = `onHand / (issuedInWindow / windowDays)` and is a rough forward-looking signal, not a forecast."
        columns={[
          {
            title: "Top moving parts",
            description: "Ranked by quantity issued inside the velocity window.",
            rows: report.turnRows,
            emptyMessage: "No ISSUE activity was recorded inside the velocity window.",
          },
        ]}
      />

      <ReportSection
        id="dead-stock"
        eyebrow="Tied-Up Value"
        title="Dead stock candidates"
        description="Parts with positive on-hand and no ISSUE activity in the dead-stock threshold window. Good targets for returns, markdowns, or physical inventory reconciliation."
        metrics={report.deadStockMetrics}
        callout="Dead stock compares the latest ISSUE transaction per part (or the part's updatedAt when no issue has ever been recorded) against today. Idle days larger than the dead-stock threshold drop into this list."
        columns={[
          {
            title: "Biggest tied-up value",
            description: "Sorted by on-hand * unit cost so the biggest dollar exposure surfaces first.",
            rows: report.deadStockRows,
            emptyMessage: "No active parts are past the dead-stock threshold right now.",
          },
        ]}
      />

      <ReportSection
        id="vendor-responsiveness"
        eyebrow="Vendors"
        title="Vendor responsiveness"
        description="Vendors with the most RECEIVE activity inside the vendor window. A proxy for who is actually moving stock through the back door."
        metrics={report.vendorMetrics}
        callout="Responsiveness uses RECEIVE transactions with a linked vendor. Vendors without a linked vendorId on the transaction are excluded so ad-hoc receives do not distort the list."
        columns={[
          {
            title: "Most active vendors",
            description: "Ranked by RECEIVE event count in the vendor window.",
            rows: report.vendorRows,
            emptyMessage: "No vendor-linked RECEIVE transactions landed inside the vendor window.",
          },
        ]}
      />
    </section>
  );
}

function ReportSection({
  id,
  eyebrow,
  title,
  description,
  metrics,
  callout,
  columns,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  metrics: DashboardMetric[];
  callout: string;
  columns: Array<{
    title: string;
    description: string;
    rows: DashboardRow[];
    emptyMessage: string;
  }>;
}) {
  return (
    <section
      id={id}
      className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="border-b border-slate-200 px-6 py-6 dark:border-slate-800">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
          {eyebrow}
        </p>
        <h3 className="mt-3 text-3xl font-black tracking-tight text-slate-950 dark:text-white">
          {title}
        </h3>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-500 dark:text-slate-400">
          {description}
        </p>
      </div>

      <div className="grid gap-4 border-b border-slate-200 px-6 py-6 md:grid-cols-2 xl:grid-cols-4 dark:border-slate-800">
        {metrics.map((metric) => (
          <MetricCard key={`${id}-${metric.label}`} metric={metric} />
        ))}
      </div>

      <div className="border-b border-slate-200 bg-slate-50 px-6 py-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
        {callout}
      </div>

      <div
        className={`grid gap-6 px-6 py-6 ${
          columns.length === 1 ? "" : columns.length === 2 ? "xl:grid-cols-2" : "xl:grid-cols-3"
        }`}
      >
        {columns.map((column) => (
          <div
            key={`${id}-${column.title}`}
            className="overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <h4 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
                {column.title}
              </h4>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                {column.description}
              </p>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {column.rows.length === 0 ? (
                <p className="px-5 py-8 text-sm text-slate-500 dark:text-slate-400">
                  {column.emptyMessage}
                </p>
              ) : (
                column.rows.map((row) => (
                  <ReportRowView key={`${column.title}-${row.label}-${row.value}`} row={row} />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function MetricCard({ metric }: { metric: DashboardMetric }) {
  const inner = (
    <>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        {metric.label}
      </p>
      <p className="mt-3 text-3xl font-black tracking-tight text-slate-950 dark:text-white">
        {metric.value}
      </p>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{metric.detail}</p>
    </>
  );

  if (!metric.href) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={metric.href}
      className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-700"
    >
      {inner}
    </Link>
  );
}

function ReportRowView({ row }: { row: DashboardRow }) {
  const inner = (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-950 dark:text-white">{row.label}</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{row.detail}</p>
      </div>
      <p className="text-right text-sm font-black uppercase tracking-[0.14em] text-slate-700 dark:text-slate-200">
        {row.value}
      </p>
    </div>
  );

  if (!row.href) {
    return <div className="px-5 py-4">{inner}</div>;
  }

  return (
    <Link
      href={row.href}
      className="block px-5 py-4 transition hover:bg-slate-50 dark:hover:bg-slate-950/70"
    >
      {inner}
    </Link>
  );
}
