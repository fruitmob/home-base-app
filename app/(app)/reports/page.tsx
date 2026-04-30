import { ReportsHubBoard } from "@/components/reports/ReportsHubBoard";
import { requirePageUser } from "@/lib/core/pageAuth";
import { getReportOverviewCards } from "@/lib/reports/dashboard";
import { loadReportsHubLayout } from "@/lib/reports/layout";

export default async function ReportsPage() {
  const user = await requirePageUser();
  const [cards, layout] = await Promise.all([
    getReportOverviewCards(user),
    loadReportsHubLayout(user.id, user.role),
  ]);

  return (
    <section className="mx-auto max-w-7xl space-y-8">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="bg-[radial-gradient(circle_at_top_left,_#38bdf8,_transparent_26%),linear-gradient(135deg,_#ecfeff_0%,_#e2e8f0_100%)] px-8 py-10 dark:bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.28),_transparent_26%),linear-gradient(135deg,_#0f172a_0%,_#020617_100%)]">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">
            Reports Hub
          </p>
          <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="max-w-4xl text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">
                Live operational snapshots across service, sales, inventory, and risk.
              </h2>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300">
                {user.email} is seeing the live reporting hub for Module 10. Use Customize layout
                to reorder the cards that matter most, hide ones you do not need, and save your
                view across sessions.
              </p>
            </div>
          </div>
        </div>
      </div>

      <ReportsHubBoard cards={cards} initialLayout={layout} />
    </section>
  );
}
