import Link from "next/link";
import type { SubscriptionStatus } from "@/generated/prisma/client";

const LABELS: Record<SubscriptionStatus, string> = {
  ACTIVE: "Active",
  TRIALING: "Trialing",
  PAST_DUE: "Past due",
  CANCELED: "Canceled",
  INCOMPLETE: "Incomplete",
  UNPAID: "Unpaid",
  PAUSED: "Paused",
};

const MESSAGES: Partial<Record<SubscriptionStatus, string>> = {
  PAST_DUE:
    "Your most recent invoice did not clear. Home Base stays fully available while you resolve it.",
  CANCELED:
    "Your Home Base subscription has been canceled. Reinstate it any time from the billing page.",
  UNPAID:
    "Stripe stopped retrying an unpaid invoice. Data access is unaffected, but please update billing when you can.",
  INCOMPLETE:
    "Your most recent checkout did not finish. Finish billing setup from the billing page whenever you are ready.",
};

export function BillingBanner({ status }: { status: SubscriptionStatus }) {
  const message = MESSAGES[status];
  if (!message) return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <p>
          <span className="font-bold uppercase tracking-[0.18em]">
            Billing · {LABELS[status]}
          </span>
          <span className="ml-3">{message}</span>
        </p>
        <Link
          href="/admin/billing"
          className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-bold text-amber-900 transition hover:bg-amber-100 dark:border-amber-900/60 dark:bg-slate-950 dark:text-amber-200 dark:hover:bg-slate-900"
        >
          Manage billing
        </Link>
      </div>
    </div>
  );
}
