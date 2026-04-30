import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";
import { IMPERSONATION_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/authConstants";
import { getCurrentUserFromSessionId } from "@/lib/auth";
import { GlobalTimerWidget } from "@/components/shop/GlobalTimerWidget";
import { canAccessAdmin } from "@/lib/core/permissions";
import { loadFlagMap } from "@/lib/flags";
import { getActiveImpersonation } from "@/lib/admin/impersonation";
import { ImpersonationBanner } from "@/components/admin/ImpersonationBanner";
import { BillingBanner } from "@/components/admin/BillingBanner";
import {
  getCurrentSubscription,
  subscriptionNeedsAttention,
} from "@/lib/billing/subscription";

type NavItem = { label: string; href: string; flagKey?: string };

const baseNavItems: NavItem[] = [
  { label: "Dashboard", href: "/" },
  { label: "Customers", href: "/customers" },
  { label: "Vehicles", href: "/vehicles" },
  { label: "Vendors", href: "/vendors" },
  { label: "Catalog", href: "/catalog" },
  { label: "Sales", href: "/sales" },
  { label: "Leads", href: "/sales/leads" },
  { label: "Pipeline", href: "/sales/opportunities" },
  { label: "Quotes", href: "/quotes" },
  { label: "Quote templates", href: "/quote-templates" },
  { label: "Cases", href: "/cases" },
  { label: "Goals", href: "/sales/goals" },
  { label: "Work orders", href: "/work-orders" },
  { label: "Lens", href: "/videos", flagKey: "nav.lens" },
  { label: "Gauge", href: "/gauge", flagKey: "nav.gauge" },
  { label: "Knowledge Base", href: "/kb" },
  { label: "Training", href: "/training", flagKey: "nav.training" },
  { label: "Reports", href: "/reports", flagKey: "nav.reports" },
];

const flaggedKeys = baseNavItems
  .map((item) => item.flagKey)
  .filter((k): k is string => k !== undefined);

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const sessionId = cookies().get(SESSION_COOKIE_NAME)?.value;
  const user = await getCurrentUserFromSessionId(sessionId);

  if (!user) {
    redirect("/login");
  }

  const impersonationId = cookies().get(IMPERSONATION_COOKIE_NAME)?.value;
  const activeImpersonation = user.role === "OWNER"
    ? await getActiveImpersonation(impersonationId, user.id)
    : null;

  const viewAsRole = activeImpersonation?.targetRole ?? user.role;

  const flagMap = await loadFlagMap(flaggedKeys);

  const visibleBase = baseNavItems.filter((item) => {
    if (!item.flagKey) return true;
    const flagValue = flagMap[item.flagKey];
    return flagValue === undefined ? true : flagValue;
  });

  const navItems: NavItem[] = canAccessAdmin(viewAsRole)
    ? [...visibleBase, { label: "Admin", href: "/admin" }]
    : visibleBase;

  const billingBannerStatus =
    user.role === "OWNER"
      ? await (async () => {
          const subscription = await getCurrentSubscription();
          if (!subscription) return null;
          return subscriptionNeedsAttention(subscription.status) ? subscription.status : null;
        })()
      : null;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 border-r border-slate-200 bg-white/90 px-6 py-8 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 lg:block">
          <Link href="/" className="block">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">
              Home Base
            </p>
            <h1 className="mt-3 text-2xl font-black tracking-tight">Foundation</h1>
          </Link>
          <nav className="mt-10 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="block rounded-2xl px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-10 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
            Reporting is now live as a real Module 10 surface. Saved layouts, exports, and heavier
            report slices will land in the next reporting steps.
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          {activeImpersonation && (
            <ImpersonationBanner
              actorEmail={activeImpersonation.actorEmail}
              targetEmail={activeImpersonation.targetEmail}
              targetRole={activeImpersonation.targetRole}
              reason={activeImpersonation.reason}
            />
          )}
          {billingBannerStatus ? <BillingBanner status={billingBannerStatus} /> : null}
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 px-5 py-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 sm:px-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
                  Service platform
                </p>
                <p className="mt-1 text-lg font-black">Command center</p>
              </div>
              <div className="flex items-center gap-3">
                <ThemeToggle />
                <UserMenu user={user} />
              </div>
            </div>
            <nav className="mt-4 flex gap-2 overflow-x-auto lg:hidden">
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="whitespace-nowrap rounded-full border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 dark:border-slate-800 dark:text-slate-300"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </header>
          <main className="flex-1 p-5 sm:p-8">{children}</main>
        </div>
      </div>
      <GlobalTimerWidget />
    </div>
  );
}
