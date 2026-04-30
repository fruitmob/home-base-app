import Link from "next/link";
import { subHours } from "date-fns";
import { listAdminAuditEntries } from "@/lib/admin/audit";
import { getExceptionCounts } from "@/lib/admin/exceptions";
import { listFeatureFlags } from "@/lib/admin/flags";
import { listAdminUsers } from "@/lib/admin/users";
import {
  listPendingGaugeWriteToolCallsForAdmin,
  listRecentGaugeWriteToolCallsForAdmin,
} from "@/lib/gauge/admin";
import { requireAdminPageUser } from "@/lib/core/pageAuth";
import { db } from "@/lib/db";

export default async function AdminPage() {
  await requireAdminPageUser();

  const auditWindowStart = subHours(new Date(), 24);
  const [
    userDirectory,
    auditEventsLastDay,
    pendingGaugeWriteCount,
    exceptionCounts,
    featureFlags,
    recentAudit,
    pendingGaugeWrites,
    recentGaugeWrites,
  ] =
    await Promise.all([
      listAdminUsers({ take: 5 }),
      db.auditLog.count({
        where: {
          createdAt: { gte: auditWindowStart },
        },
      }),
      db.gaugeToolCall.count({
        where: {
          writeRequested: true,
          status: "BLOCKED",
        },
      }),
      getExceptionCounts(),
      listFeatureFlags(),
      listAdminAuditEntries({ take: 8 }),
      listPendingGaugeWriteToolCallsForAdmin(5),
      listRecentGaugeWriteToolCallsForAdmin(5),
    ]);

  return (
    <section className="mx-auto max-w-7xl space-y-8">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="bg-[radial-gradient(circle_at_top_right,_#fcd34d,_transparent_30%),linear-gradient(135deg,_#fff7ed_0%,_#e2e8f0_100%)] px-8 py-10 dark:bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.35),_transparent_30%),linear-gradient(135deg,_#111827_0%,_#020617_100%)]">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">
            Admin Tools
          </p>
          <h2 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">
            Keep users, audit trails, and Gauge actions under one roof.
          </h2>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
            This is the owner and admin back office for the platform: who can get in, what changed,
            and where AI-assisted writes are waiting or landing.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/admin/users"
              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
            >
              Manage users
            </Link>
            <Link
              href="/admin/audit"
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              View audit trail
            </Link>
            <Link
              href="/admin/exceptions"
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Data exceptions
            </Link>
            <Link
              href="/admin/flags"
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Feature flags
            </Link>
            <Link
              href="/admin/impersonation"
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Support impersonation
            </Link>
            <Link
              href="/admin/email"
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Email templates
            </Link>
            <Link
              href="/admin/webhooks"
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Outbound webhooks
            </Link>
            <Link
              href="/admin/api-keys"
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              API keys
            </Link>
            <Link
              href="/admin/billing"
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Billing
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <MetricCard
          label="Active Users"
          value={userDirectory.counts.active}
          detail={`${userDirectory.counts.total} total accounts`}
        />
        <MetricCard
          label="Disabled Users"
          value={userDirectory.counts.inactive}
          detail="Soft-disabled and restorable"
        />
        <MetricCard
          label="Audit Events"
          value={auditEventsLastDay}
          detail="Recorded in the last 24 hours"
        />
        <MetricCard
          label="Pending Gauge Writes"
          value={pendingGaugeWriteCount}
          detail="Awaiting confirmation or follow-up"
        />
        <MetricCard
          label="Data Exceptions"
          value={exceptionCounts.total}
          detail={exceptionCounts.total === 0 ? "All clear" : "Records needing attention"}
          href="/admin/exceptions"
        />
        <MetricCard
          label="Feature Flags"
          value={featureFlags.length}
          detail={`${featureFlags.filter((f) => f.enabled).length} enabled`}
          href="/admin/flags"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5 dark:border-slate-800">
            <div>
              <h3 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
                Recent Audit Activity
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                The newest state changes across the product.
              </p>
            </div>
            <Link href="/admin/audit" className="text-sm font-bold text-slate-600 dark:text-slate-300">
              Open audit
            </Link>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {recentAudit.length === 0 ? (
              <p className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400">
                No audit events have been recorded yet.
              </p>
            ) : (
              recentAudit.map((entry) => (
                <div key={entry.id} className="px-6 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950 dark:text-white">{entry.action}</p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {entry.entityType}
                        {entry.entityId ? ` | ${entry.entityId}` : ""}
                      </p>
                    </div>
                    <div className="text-right text-xs text-slate-500 dark:text-slate-400">
                      <p>{entry.actorUser?.email ?? "System"}</p>
                      <p className="mt-1">{formatTimestamp(entry.createdAt)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5 dark:border-slate-800">
              <div>
                <h3 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
                  Pending Gauge Writes
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Confirmed-write tool calls that are still blocked or waiting.
                </p>
              </div>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {pendingGaugeWrites.length === 0 ? (
                <p className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400">
                  No pending Gauge write calls right now.
                </p>
              ) : (
                pendingGaugeWrites.map((toolCall) => (
                  <div key={toolCall.id} className="px-6 py-4">
                    <p className="font-semibold text-slate-950 dark:text-white">{toolCall.toolName}</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {toolCall.user.email} | {toolCall.user.role.replaceAll("_", " ")}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {toolCall.conversation.title} | {formatTimestamp(toolCall.createdAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5 dark:border-slate-800">
              <div>
                <h3 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
                  Recent Gauge Writes
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  The latest write-intent tool calls, whether completed or still pending.
                </p>
              </div>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {recentGaugeWrites.length === 0 ? (
                <p className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400">
                  No write-intent Gauge calls have been recorded yet.
                </p>
              ) : (
                recentGaugeWrites.map((toolCall) => (
                  <div key={toolCall.id} className="px-6 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-950 dark:text-white">{toolCall.toolName}</p>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          {toolCall.user.email} | {toolCall.conversation.title}
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {toolCall.status.replaceAll("_", " ")}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
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
  value: number;
  detail: string;
  href?: string;
}) {
  const inner = (
    <>
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-3 text-4xl font-black tracking-tight text-slate-950 dark:text-white">
        {value}
      </p>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{detail}</p>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {inner}
    </div>
  );
}

function formatTimestamp(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}
