import Link from "next/link";
import { StageBadge } from "@/components/sales/StageBadge";
import { OpportunityForm, OpportunityStageString } from "@/components/sales/OpportunityForm";
import { ActivityTimeline } from "@/components/sales/ActivityTimeline";
import { findActiveOpportunity, canMutateOpportunity } from "@/lib/sales/opportunities";
import { requirePageUser } from "@/lib/core/pageAuth";
import { formatCurrency } from "@/lib/core/money";

export default async function OpportunityDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requirePageUser();
  const opportunity = await findActiveOpportunity(params.id);
  const canMutate = canMutateOpportunity(user, opportunity.ownerUserId);

  return (
    <section className="mx-auto max-w-7xl space-y-8">
      <div className="flex items-center gap-4">
        <Link
          href="/sales/opportunities"
          className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          &larr; Pipeline
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-6">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-8">
            <div className="mb-6 flex items-start gap-4 flex-col lg:flex-row lg:justify-between lg:items-center">
              <div>
                <h2 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white">
                  {opportunity.name}
                </h2>
                {opportunity.customer && (
                  <p className="mt-1 font-medium text-slate-600 dark:text-slate-400">
                    Customer: {opportunity.customer.displayName}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-200">
                  {formatCurrency(Number(opportunity.amount))}
                </span>
                <StageBadge stage={opportunity.stage as OpportunityStageString} />
              </div>
            </div>

            <OpportunityForm
              canMutate={canMutate}
              initial={{
                id: opportunity.id,
                name: opportunity.name,
                customerId: opportunity.customerId,
                vehicleId: opportunity.vehicleId,
                ownerUserId: opportunity.ownerUserId,
                amount: Number(opportunity.amount),
                probability: opportunity.probability,
                expectedCloseDate: opportunity.expectedCloseDate,
                notes: opportunity.notes,
                stage: opportunity.stage as OpportunityStageString,
              }}
            />
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-lg font-black tracking-tight text-slate-950 dark:text-white mb-4">
              Activity History
            </h3>
            <ActivityTimeline parentKey="opportunityId" parentId={opportunity.id} />
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-950">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4 dark:text-slate-400">
              Details
            </h3>
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
                <dt className="text-slate-500 dark:text-slate-400">Converted From</dt>
                <dd className="font-semibold text-slate-900 dark:text-slate-200">
                  {opportunity.convertedFromLead ? (
                    <Link href={`/sales/leads/${opportunity.convertedFromLead.id}`} className="text-blue-600 hover:underline">
                      {opportunity.convertedFromLead.displayName}
                    </Link>
                  ) : (
                    "Direct / N/A"
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
                <dt className="text-slate-500 dark:text-slate-400">Created</dt>
                <dd className="font-semibold text-slate-900 dark:text-slate-200">
                  {new Date(opportunity.createdAt).toLocaleDateString()}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500 dark:text-slate-400">Closed At</dt>
                <dd className="font-semibold text-slate-900 dark:text-slate-200">
                  {opportunity.closedAt ? new Date(opportunity.closedAt).toLocaleDateString() : "--"}
                </dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </section>
  );
}
