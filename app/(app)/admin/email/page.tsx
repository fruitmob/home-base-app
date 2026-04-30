import Link from "next/link";
import { requireAdminPageUser } from "@/lib/core/pageAuth";
import {
  getEmailSendCounts,
  listEmailTemplatesForAdmin,
  listRecentEmailSends,
  type EmailSendSummary,
  type EmailTemplateSummary,
} from "@/lib/email/admin";

export default async function AdminEmailPage() {
  await requireAdminPageUser();

  const [templates, sends, counts] = await Promise.all([
    listEmailTemplatesForAdmin(),
    listRecentEmailSends(50),
    getEmailSendCounts(),
  ]);

  return (
    <section className="mx-auto max-w-7xl space-y-8">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="bg-[radial-gradient(circle_at_top_left,_#f472b6,_transparent_26%),linear-gradient(135deg,_#fdf2f8_0%,_#e2e8f0_100%)] px-8 py-10 dark:bg-[radial-gradient(circle_at_top_left,_rgba(244,114,182,0.32),_transparent_26%),linear-gradient(135deg,_#1f2937_0%,_#020617_100%)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">
                Integrations
              </p>
              <h2 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">
                Templated email catalog and recent delivery history.
              </h2>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300">
                Every transactional email runs through a registered template so subject lines, copy,
                and variable contracts stay consistent. This view shows the live template catalog and
                the last 50 send attempts with provider status.
              </p>
            </div>
            <Link
              href="/admin"
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Back to admin
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Templates" value={templates.length} detail="Active template records" />
        <MetricCard label="Sends" value={counts.total} detail="Total attempts on record" />
        <MetricCard label="Delivered" value={counts.sent} detail="Accepted by Resend" />
        <MetricCard label="Simulated" value={counts.simulated} detail="Local dev console fallback" />
        <MetricCard label="Failed" value={counts.failed} detail="Rejected by provider" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <TemplateList templates={templates} />
        <SendList sends={sends} />
      </div>
    </section>
  );
}

function TemplateList({ templates }: { templates: EmailTemplateSummary[] }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
        <h3 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
          Template catalog
        </h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Edits land through the seeder; versions bump automatically when copy or variables change.
        </p>
      </div>
      <div className="divide-y divide-slate-200 dark:divide-slate-800">
        {templates.length === 0 ? (
          <p className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400">
            No templates are registered yet. Run the seeder to bootstrap the default set.
          </p>
        ) : (
          templates.map((template) => (
            <div key={template.key} className="px-6 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-950 dark:text-white">{template.label}</p>
                  <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">
                    {template.key}
                  </p>
                  {template.description ? (
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                      {template.description}
                    </p>
                  ) : null}
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  v{template.version}
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">
                <span className="font-semibold">Subject:</span> {template.subject}
              </p>
              {template.variables.length > 0 ? (
                <p className="mt-2 flex flex-wrap gap-1 text-xs text-slate-500 dark:text-slate-400">
                  {template.variables.map((variable) => (
                    <code
                      key={`${template.key}-${variable}`}
                      className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    >
                      {`{{${variable}}}`}
                    </code>
                  ))}
                </p>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SendList({ sends }: { sends: EmailSendSummary[] }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
        <h3 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
          Recent sends
        </h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Last 50 attempts, newest first. Simulated rows are console-only (no key configured).
        </p>
      </div>
      <div className="divide-y divide-slate-200 dark:divide-slate-800">
        {sends.length === 0 ? (
          <p className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400">
            No templated sends have been recorded yet.
          </p>
        ) : (
          sends.map((send) => (
            <div key={send.id} className="px-6 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-950 dark:text-white">{send.subject}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {send.recipientEmail}
                  </p>
                  <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">
                    {send.templateKey} | v{send.templateVersion}
                    {send.providerMessageId ? ` | ${send.providerMessageId}` : ""}
                  </p>
                  {send.errorMessage ? (
                    <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{send.errorMessage}</p>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-1 text-xs text-slate-500 dark:text-slate-400">
                  <StatusBadge status={send.status} />
                  <span>{formatTimestamp(send.createdAt)}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const base =
    "rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.18em]";
  switch (status) {
    case "SENT":
      return <span className={`${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300`}>Sent</span>;
    case "SIMULATED":
      return <span className={`${base} bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200`}>Simulated</span>;
    case "FAILED":
      return <span className={`${base} bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300`}>Failed</span>;
    case "QUEUED":
      return <span className={`${base} bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300`}>Queued</span>;
    default:
      return <span className={`${base} bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200`}>{status}</span>;
  }
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-3 text-4xl font-black tracking-tight text-slate-950 dark:text-white">
        {value}
      </p>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{detail}</p>
    </div>
  );
}

function formatTimestamp(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}
