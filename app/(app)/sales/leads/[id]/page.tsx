import Link from "next/link";
import { notFound } from "next/navigation";
import { LeadForm } from "@/components/sales/LeadForm";
import { LeadStatusBadge } from "@/components/sales/LeadStatusBadge";
import { LeadConvertDialog } from "@/components/sales/LeadConvertDialog";
import { ActivityTimeline } from "@/components/sales/ActivityTimeline";
import { requirePageUser } from "@/lib/core/pageAuth";
import { canMutateLead, findActiveLead } from "@/lib/sales/leads";
import { isTerminalLeadStatus } from "@/lib/sales/normalize";

type LeadDetailPageProps = {
  params: {
    id: string;
  };
  searchParams: {
    convert?: string;
  };
};

export default async function LeadDetailPage({ params, searchParams }: LeadDetailPageProps) {
  const user = await requirePageUser();
  const lead = await findActiveLead(params.id).catch(() => null);

  if (!lead) {
    return notFound();
  }

  const canMutate = canMutateLead(user, lead.ownerUserId);
  const showConvertDialog = searchParams.convert === "true" && canMutate && !isTerminalLeadStatus(lead.status);

  return (
    <section className="mx-auto max-w-7xl space-y-8">
      <div className="flex items-center gap-4">
        <Link
          href="/sales/leads"
          className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          &larr; Back to Pipeline
        </Link>
      </div>

      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="px-8 py-10">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">
                Lead Detail
              </p>
              <h2 className="mt-4 flex items-center gap-4 text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                {lead.displayName}
                <LeadStatusBadge status={lead.status} />
              </h2>
              {lead.companyName && (
                <p className="mt-2 text-lg text-slate-600 dark:text-slate-300">
                  {lead.companyName}
                </p>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              {canMutate && !isTerminalLeadStatus(lead.status) && (
                <Link
                  href={`/sales/leads/${lead.id}?convert=true`}
                  className="rounded-full bg-green-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-green-700 dark:hover:bg-green-500"
                >
                  Convert to Opportunity
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-6 text-xl font-bold dark:text-white">Lead Details</h3>
            <LeadForm initial={{ ...lead, estimatedValue: lead.estimatedValue?.toString() ?? null }} canMutate={canMutate} />
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-xl font-bold dark:text-white mb-4">Activity</h3>
            <ActivityTimeline parentKey="leadId" parentId={lead.id} />
          </div>
        </div>
      </div>

      {showConvertDialog && (
        <LeadConvertDialog
          leadId={lead.id}
          defaultOpportunityName={`${lead.displayName} - New Opp`}
          defaultExpectedAmount={lead.estimatedValue ? Number(lead.estimatedValue) : null}
        />
      )}
    </section>
  );
}
