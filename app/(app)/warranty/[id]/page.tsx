import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/core/pageAuth";
import { db } from "@/lib/db";
import Link from "next/link";
import { WarrantyClaimForm } from "@/components/shop/WarrantyClaimForm";
import { format } from "date-fns";

export default async function WarrantyDetailPage({ params }: { params: { id: string } }) {
  await requirePageUser();

  const claim = await db.warrantyClaim.findUnique({
    where: { id: params.id },
    include: {
      workOrder: {
        include: {
          customer: true,
          vehicle: true,
        }
      },
      vendor: true,
    },
  });

  if (!claim || claim.deletedAt) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <Link href="/warranty" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
          &larr; Back to Warranty Claims
        </Link>
      </div>

      <div className="md:flex md:items-center md:justify-between mb-8">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 dark:text-white sm:truncate sm:text-3xl sm:tracking-tight">
            Warranty Claim {claim.claimNumber ? `#${claim.claimNumber}` : `#${claim.id.slice(-8)}`}
          </h2>
          <div className="mt-1 flex flex-col sm:mt-0 sm:flex-row sm:flex-wrap sm:space-x-6">
            <div className="mt-2 flex items-center text-sm text-gray-500">
              Work Order: <Link href={`/work-orders/${claim.workOrder.id}`} className="ml-1 text-indigo-600 hover:underline">{claim.workOrder.workOrderNumber}</Link>
            </div>
            <div className="mt-2 flex items-center text-sm text-gray-500">
              Customer: {claim.workOrder.customer.firstName} {claim.workOrder.customer.lastName}
            </div>
            <div className="mt-2 flex items-center text-sm text-gray-500">
              Vehicle: {claim.workOrder.vehicle ? `${claim.workOrder.vehicle.year} ${claim.workOrder.vehicle.make} ${claim.workOrder.vehicle.model}` : "Unknown"}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-slate-50 dark:bg-zinc-800 rounded-lg p-6 border border-slate-200 dark:border-zinc-700">
            <h3 className="text-lg font-bold mb-4">Claim Details</h3>
            <WarrantyClaimForm claim={claim as any /* eslint-disable-line @typescript-eslint/no-explicit-any */} />
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-white dark:bg-zinc-900 rounded-lg p-6 border border-slate-200 dark:border-zinc-700 shadow-sm">
            <h3 className="text-sm font-medium text-slate-500 dark:text-zinc-400">Status</h3>
            <p className="mt-1 font-semibold text-slate-900 dark:text-zinc-100">
              <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold leading-5 ${claim.status === "RECOVERED" ? "bg-green-100 text-green-800 dark:bg-green-500/10 dark:text-green-400" : claim.status === "DENIED" ? "bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-400" : "bg-yellow-100 text-yellow-800 dark:bg-yellow-500/10 dark:text-yellow-400"}`}>
                {claim.status}
              </span>
            </p>

            {claim.submittedAt && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-slate-500 dark:text-zinc-400">Submitted Dates</h3>
                <p className="mt-1 text-sm text-slate-900 dark:text-zinc-100">{format(claim.submittedAt, "MMM d, yyyy")}</p>
              </div>
            )}

            {claim.resolvedAt && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-slate-500 dark:text-zinc-400">Resolved Date</h3>
                <p className="mt-1 text-sm text-slate-900 dark:text-zinc-100">{format(claim.resolvedAt, "MMM d, yyyy")}</p>
              </div>
            )}

            <div className="mt-4">
              <h3 className="text-sm font-medium text-slate-500 dark:text-zinc-400">Vendor</h3>
              <p className="mt-1 text-sm text-slate-900 dark:text-zinc-100">{claim.vendor?.name || "Internal"}</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
