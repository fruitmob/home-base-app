import { requirePageUser } from "@/lib/core/pageAuth";
import { SALES_WRITE_ROLES } from "@/lib/core/permissions";
import { OpportunityForm } from "@/components/sales/OpportunityForm";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function NewOpportunityPage() {
  const user = await requirePageUser();
  const canMutate = (SALES_WRITE_ROLES as readonly string[]).includes(user.role);

  if (!canMutate) {
    notFound(); 
  }

  return (
    <section className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-center gap-4">
        <Link
          href="/sales/opportunities"
          className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          &larr; Back to pipeline
        </Link>
      </div>
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-12">
        <h2 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl mb-2">
          New Opportunity
        </h2>
        <p className="text-slate-500 max-w-lg mb-8 dark:text-slate-400">
          Create a new pipeline opportunity to track potential revenue. Opportunities represent active deals with prospective or existing customers.
        </p>
        
        <OpportunityForm canMutate={canMutate} initial={{ ownerUserId: user.id }} />
      </div>
    </section>
  );
}
