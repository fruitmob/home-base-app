import Link from "next/link";
import { requirePageRole } from "@/lib/core/pageAuth";
import { db } from "@/lib/db";
import {
  getCurrentSubscription,
  subscriptionNeedsAttention,
} from "@/lib/billing/subscription";

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  TRIALING: "Trialing",
  PAST_DUE: "Past due",
  CANCELED: "Canceled",
  INCOMPLETE: "Incomplete",
  UNPAID: "Unpaid",
  PAUSED: "Paused",
};

export default async function AdminBillingPage() {
  await requirePageRole(["OWNER"]);

  const checkoutUrl = process.env.STRIPE_CHECKOUT_URL ?? null;
  const portalUrl = process.env.STRIPE_CUSTOMER_PORTAL_URL ?? null;
  const webhookConfigured = Boolean(process.env.STRIPE_WEBHOOK_SECRET);

  const [subscription, events] = await Promise.all([
    getCurrentSubscription(),
    db.billingEvent.findMany({
      orderBy: [{ receivedAt: "desc" }],
      take: 25,
      select: {
        id: true,
        stripeEventId: true,
        eventType: true,
        receivedAt: true,
        processedAt: true,
        errorMessage: true,
      },
    }),
  ]);

  const needsAttention = subscription ? subscriptionNeedsAttention(subscription.status) : false;

  return (
    <section className="mx-auto max-w-7xl space-y-8">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="bg-[radial-gradient(circle_at_top_right,_#f472b6,_transparent_26%),linear-gradient(135deg,_#fdf2f8_0%,_#e2e8f0_100%)] px-8 py-10 dark:bg-[radial-gradient(circle_at_top_right,_rgba(244,114,182,0.28),_transparent_26%),linear-gradient(135deg,_#1f2937_0%,_#020617_100%)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">
                Integrations
              </p>
              <h2 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">
                Subscription and billing.
              </h2>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300">
                Home Base mirrors your Stripe subscription here so you can see license state without
                leaving the product. Subscription changes happen in Stripe; this view updates as
                Stripe sends us webhook events.
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
            <h3 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
              Subscription status
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Reflects the latest Stripe subscription event Home Base has processed.
            </p>
          </div>
          <div className="space-y-4 px-6 py-5">
            {subscription ? (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge status={subscription.status} />
                  <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                    {subscription.stripeSubscriptionId}
                  </span>
                </div>
                <dl className="grid gap-3 text-sm md:grid-cols-2">
                  <Row label="Stripe customer" value={subscription.stripeCustomerId} mono />
                  <Row
                    label="Current period"
                    value={formatDateRange(subscription.currentPeriodStart, subscription.currentPeriodEnd)}
                  />
                  <Row
                    label="Cancels at period end?"
                    value={subscription.cancelAtPeriodEnd ? "Yes" : "No"}
                  />
                  <Row label="Cancel at" value={formatDate(subscription.cancelAt)} />
                  <Row label="Canceled at" value={formatDate(subscription.canceledAt)} />
                  <Row label="Latest event" value={formatTimestamp(subscription.latestEventAt)} />
                </dl>
              </>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No subscription record yet. Once Stripe posts the first subscription event to
                <span className="mx-1 font-mono">/api/webhooks/stripe</span>, it will show up here.
              </p>
            )}
            {needsAttention ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                The subscription is in a state that usually needs owner attention. Home Base data
                access stays available — no feature is disabled by this banner.
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
            <h3 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
              Manage billing in Stripe
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Set these env vars for this deployment and the links below become live.
            </p>
          </div>
          <div className="space-y-4 px-6 py-5">
            <LinkRow
              label="Start or upgrade checkout"
              envVar="STRIPE_CHECKOUT_URL"
              url={checkoutUrl}
              cta="Open Stripe Checkout"
            />
            <LinkRow
              label="Update payment method or cancel"
              envVar="STRIPE_CUSTOMER_PORTAL_URL"
              url={portalUrl}
              cta="Open Stripe Customer Portal"
            />
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
              <p>
                <span className="font-semibold">Webhook endpoint:</span>{" "}
                <code className="font-mono">/api/webhooks/stripe</code>
              </p>
              <p className="mt-2">
                <span className="font-semibold">Signature verification:</span>{" "}
                {webhookConfigured ? (
                  <span className="text-emerald-600 dark:text-emerald-400">Configured</span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400">
                    STRIPE_WEBHOOK_SECRET not set — webhook will 503 until you configure it
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
          <h3 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
            Recent Stripe events
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Last 25 events ingested by the webhook, newest first.
          </p>
        </div>
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {events.length === 0 ? (
            <p className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400">
              No Stripe events have been received yet.
            </p>
          ) : (
            events.map((event) => (
              <div key={event.id} className="px-6 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-950 dark:text-white">{event.eventType}</p>
                    <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">
                      {event.stripeEventId}
                    </p>
                    {event.errorMessage ? (
                      <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">
                        {event.errorMessage}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-right text-xs text-slate-500 dark:text-slate-400">
                    <p>{formatTimestamp(event.receivedAt)}</p>
                    <p className="mt-1">
                      {event.processedAt ? "Processed" : "Pending"}
                      {event.errorMessage ? " (with error)" : ""}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: keyof typeof STATUS_LABELS }) {
  const base = "rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.18em]";
  const style =
    status === "ACTIVE" || status === "TRIALING"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
      : status === "PAUSED"
        ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
        : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
  return <span className={`${base} ${style}`}>{STATUS_LABELS[status] ?? status}</span>;
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className={`text-sm text-slate-900 dark:text-white ${mono ? "font-mono" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function LinkRow({
  label,
  envVar,
  url,
  cta,
}: {
  label: string;
  envVar: string;
  url: string | null;
  cta: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">{envVar}</p>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
        >
          {cta}
        </a>
      ) : (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          Set {envVar} in your deployment environment to enable this button.
        </p>
      )}
    </div>
  );
}

function formatDateRange(start: Date | null, end: Date | null) {
  if (!start && !end) return "—";
  const format = (value: Date | null) =>
    value
      ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value))
      : "—";
  return `${format(start)} → ${format(end)}`;
}

function formatDate(value: Date | null) {
  return value
    ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value))
    : "—";
}

function formatTimestamp(value: Date | null) {
  return value
    ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(value),
      )
    : "—";
}
