import Link from "next/link";
import { Prisma, Role } from "@/generated/prisma/client";
import { PipelineKanban } from "@/components/sales/PipelineKanban";
import { requirePageUser } from "@/lib/core/pageAuth";
import { db } from "@/lib/db";
import { SALES_WRITE_ROLES } from "@/lib/core/permissions";

type OpportunitiesPageProps = {
  searchParams?: {
    ownerUserId?: string;
  };
};

export default async function OpportunitiesPage({ searchParams }: OpportunitiesPageProps) {
  const user = await requirePageUser();
  const canMutate = (SALES_WRITE_ROLES as readonly string[]).includes(user.role);
  
  const ownerUserIdParam = searchParams?.ownerUserId?.trim() ?? "";

  const whereAnd: Prisma.OpportunityWhereInput[] = [{ deletedAt: null }];

  if (user.role === Role.SALES_REP) {
    if (ownerUserIdParam === user.id) {
      whereAnd.push({ ownerUserId: user.id });
    } else if (ownerUserIdParam === "unassigned") {
      whereAnd.push({ ownerUserId: null });
    } else if (ownerUserIdParam) {
      // Sales reps cannot view others' opps explicitly assigned
      whereAnd.push({ id: "restricted" }); 
    } else {
      whereAnd.push({
        OR: [{ ownerUserId: user.id }, { ownerUserId: null }],
      });
    }
  } else {
    // Managers/Admins
    if (ownerUserIdParam === "unassigned") {
      whereAnd.push({ ownerUserId: null });
    } else if (ownerUserIdParam) {
      whereAnd.push({ ownerUserId: ownerUserIdParam });
    }
  }

  // To prevent the pipeline from overflowing, we limit WON/LOST opps 
  // to those closed within the last 30 days.
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  whereAnd.push({
    OR: [
      { stage: { notIn: ["WON", "LOST"] } },
      { 
        AND: [
          { stage: { in: ["WON", "LOST"] } },
          { closedAt: { gte: thirtyDaysAgo } }
        ]
      }
    ]
  });

  const opportunities = await db.opportunity.findMany({
    where: { AND: whereAnd },
    orderBy: [{ createdAt: "desc" }],
    take: 300,
    include: {
      customer: { select: { id: true, displayName: true } }
    },
  });

  // Typecast for the UI 
  // Amounts are Decimals in Prisma, need to serialize for Client component
  const typedOpportunities = opportunities.map(opp => ({
    id: opp.id,
    name: opp.name,
    stage: opp.stage as "NEW" | "QUALIFIED" | "PROPOSAL" | "NEGOTIATION" | "WON" | "LOST",
    amount: Number(opp.amount),
    customer: opp.customer ? { id: opp.customer.id, displayName: opp.customer.displayName } : undefined,
  }));

  const activeCount = opportunities.filter(o => o.stage !== "WON" && o.stage !== "LOST").length;

  return (
    <section className="mx-auto max-w-[1400px] space-y-8">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="bg-[radial-gradient(circle_at_top_right,_#bfdbfe,_transparent_35%),linear-gradient(135deg,_#f8fafc_0%,_#e2e8f0_100%)] px-8 py-10 dark:bg-[radial-gradient(circle_at_top_right,_rgba(30,64,175,0.5),_transparent_35%),linear-gradient(135deg,_#020617_0%,_#0f172a_100%)]">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">
            Sales CRM
          </p>
          <div className="mt-4 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <h2 className="max-w-3xl text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">
                Opportunity Pipeline
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
                Track your active deals across stages.
              </p>
            </div>
            {canMutate && (
              <Link
                href="/sales/opportunities/new"
                className="inline-flex items-center justify-center rounded-full bg-blue-600 px-6 py-3 font-bold text-white transition hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                New Opportunity
              </Link>
            )}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <span className="rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white dark:bg-white dark:text-slate-950">
              {activeCount} active opportunit{activeCount === 1 ? "y" : "ies"}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <form className="flex rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:w-[320px] flex-col mb-4">
          <label className="flex-1">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Assigned
            </span>
            <div className="flex gap-2 items-center mt-2">
              <select
                name="ownerUserId"
                defaultValue={ownerUserIdParam}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-slate-800"
              >
                <option value="">Anyone</option>
                <option value={user.id}>Me</option>
                <option value="unassigned">Unassigned</option>
              </select>
              <button
                type="submit"
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Go
              </button>
            </div>
          </label>
        </form>

        <PipelineKanban initialOpportunities={typedOpportunities} canMutate={canMutate} />
      </div>
    </section>
  );
}
