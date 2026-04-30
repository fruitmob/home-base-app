import Link from "next/link";
import type { DashboardMetric, DashboardRow } from "@/lib/reports/dashboard";
import type { SalesCustomerReport } from "@/lib/reports/sales";

export function SalesPerformanceReportView({ report }: { report: SalesCustomerReport }) {
  return (
    <section className="mx-auto max-w-7xl space-y-8">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="bg-[radial-gradient(circle_at_top_right,_#fb7185,_transparent_24%),linear-gradient(135deg,_#fff7ed_0%,_#ecfccb_100%)] px-8 py-10 dark:bg-[radial-gradient(circle_at_top_right,_rgba(251,113,133,0.24),_transparent_24%),linear-gradient(135deg,_#111827_0%,_#022c22_100%)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">
                Sales Reports
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
                href="/api/reports/sales/export"
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Download CSV
              </a>
              <Link
                href="/sales/opportunities"
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
              >
                Open pipeline
              </Link>
            </div>
          </div>

          <div className="mt-6 inline-flex rounded-full border border-white/70 bg-white/80 px-4 py-2 text-sm font-bold uppercase tracking-[0.22em] text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200">
            {report.scopeLabel}
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
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
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
        id="pipeline-conversion"
        eyebrow="Pipeline"
        title="Pipeline conversion and current stage age"
        description="This section answers two different questions: how healthy the open stage mix looks right now, and how recently closed opportunities are converting into wins."
        metrics={report.pipelineMetrics}
        callout="Current stage age is a proxy from the opportunity's latest `updatedAt` timestamp. Conversion uses opportunities closed in the last 90 days."
        columns={[
          {
            title: "Stage mix",
            description: "Count and open revenue by current stage.",
            rows: report.stageRows,
            emptyMessage: "No open opportunities are active right now.",
          },
          {
            title: "Current stage age",
            description: "Average days since the last opportunity change in each open stage.",
            rows: report.stageAgeRows,
            emptyMessage: "No stage-age rows are available right now.",
          },
          {
            title: "Oldest current-stage deals",
            description: "Open opportunities with the most time since their last update.",
            rows: report.oldestOpenRows,
            emptyMessage: "No active opportunities are waiting in open stages right now.",
          },
        ]}
      />

      <ReportSection
        id="rep-performance"
        eyebrow="Goals"
        title="Rep performance vs goal"
        description="Keep current-month targets, won revenue, overdue follow-ups, and open pipeline pressure in one place so coaching and accountability are grounded in the same numbers."
        metrics={report.performanceMetrics}
        callout="Goal attainment uses won opportunity amount inside the current calendar month. Follow-up pressure counts open lead or opportunity activities due now or overdue."
        columns={[
          {
            title: "Performance rows",
            description: "One row per rep or scoped owner in the report window.",
            rows: report.performanceRows,
            emptyMessage: "No scoped goal or follow-up rows are available right now.",
          },
        ]}
      />

      <ReportSection
        id="customer-growth"
        eyebrow="Customers"
        title="Repeat customers and starter value"
        description="This starter customer-growth slice shows which accounts are coming back across sales and service touchpoints, and it adds a non-duplicative value proxy where the schema has enough signal."
        metrics={report.customerMetrics}
        callout="Starter value proxy combines won opportunity amount with unlinked accepted quotes, approved estimates, and work-order subtotals to reduce double counting through the sales-to-service chain."
        columns={[
          {
            title: "Customer momentum",
            description: "Customers ranked by starter value proxy, then by total touch count.",
            rows: report.customerRows,
            emptyMessage: "No customer-growth rows are available in the current report window.",
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
                column.rows.map((row) => <ReportRowView key={`${column.title}-${row.label}-${row.value}`} row={row} />)
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
