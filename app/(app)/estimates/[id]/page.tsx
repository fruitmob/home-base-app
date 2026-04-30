import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/core/pageAuth";
import { db } from "@/lib/db";
import { formatCurrency } from "@/lib/core/money";
import { EstimateLineEditor } from "@/components/shop/EstimateLineEditor";
import { EstimateActions } from "@/components/shop/EstimateActions";

export default async function EstimateDetailPage({ params }: { params: { id: string } }) {
  await requirePageUser();

  const estimate = await db.estimate.findUnique({
    where: { id: params.id, deletedAt: null },
    include: {
      customer: true,
      vehicle: true,
      lineItems: {
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!estimate) {
    notFound();
  }

  const isEditable = estimate.status === "DRAFT";

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header section */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight dark:text-white">
            Estimate {estimate.estimateNumber}
          </h2>
          <div className="mt-1 flex flex-col sm:mt-0 sm:flex-row sm:flex-wrap sm:space-x-6">
            <div className="mt-2 flex items-center text-sm text-gray-500 dark:text-gray-400">
              Customer: {estimate.customer.displayName || `${estimate.customer.firstName} ${estimate.customer.lastName}`}
            </div>
            {estimate.vehicle && (
              <div className="mt-2 flex items-center text-sm text-gray-500 dark:text-gray-400">
                Vehicle: {estimate.vehicle.year} {estimate.vehicle.make} {estimate.vehicle.model}
              </div>
            )}
            <div className="mt-2 flex items-center text-sm text-gray-500 dark:text-gray-400">
              Status: <span className="ml-1 font-semibold">{estimate.status}</span>
            </div>
            {estimate.convertedWorkOrderId && (
              <div className="mt-2 flex items-center text-sm text-indigo-600 dark:text-indigo-400">
                Converted to Work Order
              </div>
            )}
          </div>
        </div>
        <div className="mt-4 flex md:ml-4 md:mt-0 space-x-3">
          <EstimateActions estimate={estimate} />
        </div>
      </div>

      <div className="bg-white px-4 py-5 shadow sm:rounded-lg sm:px-6 dark:bg-zinc-900 ring-1 ring-gray-900/5 dark:ring-zinc-800">
        <h3 className="text-base font-semibold leading-6 text-gray-900 dark:text-white mb-4">Line Items</h3>
        
        <EstimateLineEditor
          estimateId={estimate.id}
          initialLineItems={estimate.lineItems.map(l => ({
            ...l,
            quantity: Number(l.quantity),
            unitPrice: Number(l.unitPrice),
            unitCost: l.unitCost ? Number(l.unitCost) : null,
            lineTotal: Number(l.lineTotal)
          }))}
          canMutate={isEditable}
        />
        
        <div className="mt-6 flex justify-end">
          <div className="max-w-xs w-full text-sm text-gray-500">
            <div className="flex justify-between py-2 border-b dark:border-zinc-800">
              <span>Total</span>
              <span className="font-bold text-gray-900 dark:text-white">{formatCurrency(Number(estimate.total))}</span>
            </div>
          </div>
        </div>
      </div>
      
      {estimate.notes && (
        <div className="bg-white px-4 py-5 shadow sm:rounded-lg sm:px-6 dark:bg-zinc-900 ring-1 ring-gray-900/5 dark:ring-zinc-800">
          <h3 className="text-base font-semibold leading-6 text-gray-900 dark:text-white">Customer Notes & Complaint</h3>
          <div className="mt-2 text-sm text-gray-600 dark:text-zinc-400 whitespace-pre-wrap">
            {estimate.notes}
          </div>
        </div>
      )}
    </div>
  );
}
