import Link from "next/link";
import type { CloseoutReport } from "@/lib/reports/closeout";
import type { DashboardMetric, DashboardRow } from "@/lib/reports/dashboard";

export function CloseoutReportView({ report }: { report: CloseoutReport }) {
  return (
    <section className="mx-auto max-w-7xl space-y-8">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="bg-[radial-gradient(circle_at_top_right,_#10b981,_transparent_24%),linear-gradient(135deg,_#ecfdf5_0%,_#e2e8f0_100%)] px-8 py-10 dark:bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.28),_transparent_24%),linear-gradient(135deg,_#111827_0%,_#020617_100%)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">
                Closeout Reports
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
                href="/api/reports/closeout/export"
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Download CSV
              </a>
              <a
                href="/api/reports/closeout/export-pdf"
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Download PDF
              </a>
              <Link
                href="/work-orders"
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
              >
                Open work orders
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
        id="ready-to-bill"
        eyebrow="Unbilled Revenue"
        title="Ready-to-bill queue"
        description="Work orders sitting in READY_TO_BILL, ranked by how long they have been idle so the oldest unbilled value surfaces first."
        metrics={report.readyToBillMetrics}
        callout="Ready-to-bill value uses the current subtotal of active WorkOrderLineItem rows. Idle days come from the work order `updatedAt` timestamp."
        columns={[
          {
            title: "Oldest ready-to-bill",
            description: "Sorted by `updatedAt` ascending so the most stagnant jobs are visible first.",
            rows: report.readyToBillRows,
            emptyMessage: "No work orders are currently ready-to-bill.",
          },
        ]}
      />

      <ReportSection
        id="approvals"
        eyebrow="Approvals"
        title="Approved estimate and change-order totals"
        description="Everything that was approved inside the approval window is captured here so finance can reconcile what has been agreed to against what has been billed."
        metrics={report.approvedMetrics}
        callout="Approved totals include `Estimate.total` for APPROVED estimates and `ChangeOrder.total` for APPROVED change orders. Both use the `approvedAt` timestamp to stay inside the approval window."
        columns={[
          {
            title: "Approved estimates",
            description: "Largest approved estimate totals first.",
            rows: report.approvedEstimateRows,
            emptyMessage: "No estimates were approved inside the approval window.",
          },
          {
            title: "Approved change orders",
            description: "Largest approved change-order totals first.",
            rows: report.approvedChangeOrderRows,
            emptyMessage: "No change orders were approved inside the approval window.",
          },
        ]}
      />

      <ReportSection
        id="warranty-recovery"
        eyebrow="Recovery"
        title="Warranty recovery"
        description="Money already recovered from warranty claims inside the recovery window, plus a quick look at the open exposure that has not resolved yet."
        metrics={report.warrantyMetrics}
        callout="Recovered totals use `WarrantyClaim.recoveryAmount` for claims with status RECOVERED. Open exposure uses the same field for claims that are still OPEN, SUBMITTED, or APPROVED."
        columns={[
          {
            title: "Recent recovered claims",
            description: "Most recently resolved recovered claims first.",
            rows: report.warrantyRows,
            emptyMessage: "No warranty claims were recovered inside the recovery window.",
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
