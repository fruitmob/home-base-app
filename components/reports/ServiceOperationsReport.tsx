import Link from "next/link";
import type { DashboardMetric, DashboardRow } from "@/lib/reports/dashboard";
import type { ServiceOperationsReport } from "@/lib/reports/service";

export function ServiceOperationsReportView({ report }: { report: ServiceOperationsReport }) {
  return (
    <section className="mx-auto max-w-7xl space-y-8">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="bg-[radial-gradient(circle_at_top_right,_#f97316,_transparent_24%),linear-gradient(135deg,_#fff7ed_0%,_#e2e8f0_100%)] px-8 py-10 dark:bg-[radial-gradient(circle_at_top_right,_rgba(249,115,22,0.28),_transparent_24%),linear-gradient(135deg,_#111827_0%,_#020617_100%)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">
                Service Reports
              </p>
              <h2 className="mt-4 max-w-4xl text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">
                WIP aging, cycle time, estimate drift, tech capture, and QC load in one service view.
              </h2>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300">
                This page keeps the report math explicit so the team can trust what they are
                seeing: active WIP is live, cycle time is based on closed work orders, actual vs
                estimate compares current work-order subtotal to the source estimate, and tech
                capture comes straight from tracked time-entry minutes.
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
                href="/api/reports/service/export"
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Download CSV
              </a>
              <a
                href="/api/reports/service/export-pdf"
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
        id="wip-aging"
        eyebrow="Live Floor"
        title="WIP aging"
        description="Use this section to see where work is backing up right now: bucketed by age, split by service lane, and ranked by the oldest active jobs."
        metrics={report.wipMetrics}
        callout="Aging is based on calendar days since `openedAt` for any work order still in an active status."
        columns={[
          {
            title: "Aging buckets",
            description: "How old the active queue is right now.",
            rows: report.agingRows,
            emptyMessage: "No active work orders are on the board right now.",
          },
          {
            title: "Status lanes",
            description: "Current distribution by service state.",
            rows: report.statusRows,
            emptyMessage: "No active work orders are in service states right now.",
          },
          {
            title: "Oldest active work",
            description: "The jobs most likely to need intervention next.",
            rows: report.oldestRows,
            emptyMessage: "No active work orders are aging right now.",
          },
        ]}
      />

      <ReportSection
        id="actual-vs-estimate"
        eyebrow="Estimate Drift"
        title="Actual vs estimated"
        description="This compares the source estimate total to the current subtotal of the converted work order. It answers whether the live job is landing above or below the original estimate."
        metrics={report.actualEstimateMetrics}
        callout="Actual uses the current subtotal of active work-order line items. Estimate uses the source `Estimate.total` from the converted estimate record."
        columns={[
          {
            title: "Biggest variance rows",
            description: "Largest absolute drift between source estimate and current work-order subtotal.",
            rows: report.actualEstimateRows,
            emptyMessage: "No converted estimate-backed work orders were found in this report window.",
          },
        ]}
      />

      <ReportSection
        id="cycle-time"
        eyebrow="Throughput"
        title="Cycle time"
        description="Closed-work-order throughput over the last 30 days, with status-segment dwell pulled from status-history timestamps."
        metrics={report.cycleMetrics}
        callout="Average cycle time uses `closedAt - openedAt`. Segment dwell uses the time between one status-history row and the next."
        columns={[
          {
            title: "Average segment dwell",
            description: "How long closed work orders tend to stay in each status segment.",
            rows: report.cycleStageRows,
            emptyMessage: "Not enough status-history data is available yet for segment dwell analysis.",
          },
          {
            title: "Recent closed work",
            description: "Most recent closed work orders and their total cycle time.",
            rows: report.cycleRecentRows,
            emptyMessage: "No work orders closed during the current cycle window.",
          },
        ]}
      />

      <ReportSection
        id="tech-utilization"
        eyebrow="Time Performance"
        title="Technician utilization and capture"
        description="This is the first service-side time report. Until Home Base has a separate shift-clock model, utilization is represented as tracked work hours plus billable capture and goodwill rate."
        metrics={report.technicianMetrics}
        callout="Capture = `billableMinutes / durationMinutes`. Goodwill rate = `goodwillMinutes / durationMinutes`. All values use time entries started in the last 30 days."
        columns={[
          {
            title: "Per-tech summary",
            description: "Tracked hours, billable hours, and capture rate by technician.",
            rows: report.technicianRows,
            emptyMessage: "No time entries landed inside the technician report window.",
          },
        ]}
      />

      <ReportSection
        id="qc-load"
        eyebrow="Quality"
        title="QC and inspection load"
        description="Keep an eye on the quality lane, draft inspections, and open warranty exposure so work does not hide in the handoff between repair and closeout."
        metrics={report.qcMetrics}
        callout="Time in QC is measured from the latest QC status-history timestamp to now. Draft inspection backlog is live; completed inspections use the last 7 days."
        columns={[
          {
            title: "Current QC queue",
            description: "Jobs sitting in QC right now, ranked by time already spent there.",
            rows: report.qcRows,
            emptyMessage: "No work orders are currently in QC.",
          },
          {
            title: "Inspection backlog",
            description: "Draft arrival or PDI inspections that still need to be completed.",
            rows: report.inspectionRows,
            emptyMessage: "No draft inspections are waiting right now.",
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
