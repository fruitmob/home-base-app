import Link from "next/link";
import { Activity, OpportunityStage, Role } from "@/generated/prisma/client";
import { AttainmentCard } from "@/components/sales/AttainmentCard";
import { PipelineSummary } from "@/components/sales/PipelineSummary";
import { RecentActivity } from "@/components/sales/RecentActivity";
import { formatCurrency } from "@/lib/core/money";
import { requirePageUser } from "@/lib/core/pageAuth";
import { attainment } from "@/lib/sales/goals";
import { db } from "@/lib/db";

const STAGES = ["NEW", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"] as const;

export default async function SalesDashboardPage() {
  const user = await requirePageUser();
  const isRep = user.role === Role.SALES_REP;
  const currentPeriod = getCurrentPeriod();

  const opportunityWhere = {
    deletedAt: null,
    ...(isRep ? { ownerUserId: user.id } : {}),
  };

  const [opportunities, goals, activities] = await Promise.all([
    db.opportunity.findMany({
      where: opportunityWhere,
      include: {
        ownerUser: { select: { id: true, email: true } },
        customer: { select: { id: true, displayName: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 300,
    }),
    db.salesGoal.findMany({
      where: {
        deletedAt: null,
        period: currentPeriod,
        ...(isRep ? { userId: user.id } : {}),
      },
      include: {
        user: { select: { id: true, email: true } },
      },
      orderBy: [{ user: { email: "asc" } }],
      take: isRep ? 1 : 25,
    }),
    db.activity.findMany({
      where: {
        deletedAt: null,
        ...(isRep ? { ownerUserId: user.id } : {}),
        OR: [
          { leadId: { not: null } },
          { opportunityId: { not: null } },
          { caseId: { not: null } },
        ],
      },
      include: {
        ownerUser: { select: { id: true, email: true } },
        lead: { select: { id: true, displayName: true } },
        opportunity: { select: { id: true, name: true } },
        case: { select: { id: true, subject: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const pipelineStages = STAGES.map((stage) => {
    const stageRows = opportunities.filter((opportunity) => opportunity.stage === stage);

    return {
      stage,
      count: stageRows.length,
      amount: stageRows.reduce((sum, opportunity) => sum + Number(opportunity.amount), 0),
    };
  });

  const attainmentRows = await Promise.all(
    goals.map(async (goal) => {
      const attainmentAmount = await attainment(goal.userId, goal.period);
      const targetAmount = Number(goal.targetAmount);

      return {
        id: goal.id,
        label: goal.user.email,
        period: goal.period,
        targetAmount,
        attainmentAmount,
        attainmentPercent: targetAmount > 0 ? Math.round((attainmentAmount / targetAmount) * 100) : 0,
      };
    }),
  );

  const leaderboard = [...attainmentRows].sort((a, b) => {
    if (b.attainmentAmount !== a.attainmentAmount) {
      return b.attainmentAmount - a.attainmentAmount;
    }

    return b.attainmentPercent - a.attainmentPercent;
  });

  const activePipelineAmount = opportunities
    .filter((opportunity) => opportunity.stage !== OpportunityStage.WON && opportunity.stage !== OpportunityStage.LOST)
    .reduce((sum, opportunity) => sum + Number(opportunity.amount), 0);

  return (
    <section className="mx-auto max-w-7xl space-y-8">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="bg-[linear-gradient(135deg,_#f8fafc_0%,_#dbeafe_100%)] px-8 py-10 dark:bg-[linear-gradient(135deg,_#020617_0%,_#172554_100%)]">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">
            Sales CRM
          </p>
          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="max-w-3xl text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">
                {isRep ? "My Sales Desk" : "Team Sales Desk"}
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
                Pipeline, targets, and recent customer touches in one place.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/sales/leads"
                className="rounded-full bg-white px-5 py-3 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                Leads
              </Link>
              <Link
                href="/sales/opportunities"
                className="rounded-full bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
              >
                Pipeline
              </Link>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <Metric label="Open Pipeline" value={formatCurrency(activePipelineAmount)} />
            <Metric label="Opportunities" value={String(opportunities.length)} />
            <Metric label="Goal Period" value={currentPeriod} />
          </div>
        </div>
      </div>

      <PipelineSummary
        title={isRep ? "My Pipeline" : "Team Pipeline"}
        stages={pipelineStages}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <AttainmentCard
          title={isRep ? "My Attainment" : "Team Attainment"}
          rows={attainmentRows}
        />
        <RecentActivity rows={activities.map(toRecentActivityRow)} />
      </div>

      {!isRep ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
            Leaderboard
          </p>
          <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white">
            Won Revenue
          </h3>
          <div className="mt-6 divide-y divide-slate-200 dark:divide-slate-800">
            {leaderboard.map((row, index) => (
              <div key={row.id} className="flex items-center justify-between gap-4 py-4">
                <div>
                  <p className="font-bold text-slate-950 dark:text-white">
                    {index + 1}. {row.label}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {row.attainmentPercent}% of {formatCurrency(row.targetAmount)}
                  </p>
                </div>
                <p className="text-lg font-black text-slate-950 dark:text-white">
                  {formatCurrency(row.attainmentAmount)}
                </p>
              </div>
            ))}
            {leaderboard.length === 0 ? (
              <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                No goals set for this period.
              </p>
            ) : null}
          </div>
        </section>
      ) : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}

function toRecentActivityRow(activity: Activity & {
  ownerUser: { email: string } | null;
  lead: { id: string; displayName: string } | null;
  opportunity: { id: string; name: string } | null;
  case: { id: string; subject: string } | null;
}) {
  const parent = activity.lead
    ? {
        href: `/sales/leads/${activity.lead.id}`,
        label: activity.lead.displayName,
      }
    : activity.opportunity
      ? {
          href: `/sales/opportunities/${activity.opportunity.id}`,
          label: activity.opportunity.name,
        }
      : activity.case
        ? {
            href: `/cases/${activity.case.id}`,
            label: activity.case.subject,
          }
        : {
            href: "/sales",
            label: "Sales activity",
          };

  return {
    id: activity.id,
    type: activity.type,
    subject: activity.subject,
    createdAt: activity.createdAt.toISOString(),
    ownerEmail: activity.ownerUser?.email ?? null,
    href: parent.href,
    parentLabel: parent.label,
  };
}

function getCurrentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
