import { requirePageUser } from "@/lib/core/pageAuth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/20/solid";
import { PartForm } from "@/components/shop/PartForm";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export default async function PartDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requirePageUser();

  const part = await db.part.findUnique({
    where: { id: params.id, deletedAt: null },
    include: {
      transactions: {
        orderBy: { occurredAt: "desc" },
        include: { createdByUser: true },
      },
      reservations: {
        where: { status: "ACTIVE" },
        orderBy: { reservedAt: "desc" },
        include: { workOrder: true, reservedByUser: true },
      },
    },
  });

  if (!part) {
    notFound();
  }

  const onHand = Number(part.quantityOnHand);
  const reserved = Number(part.quantityReserved);
  const available = onHand - reserved;
  const isLow = available <= Number(part.reorderPoint);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Link
          href="/parts"
          className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          <ArrowLeftIcon className="mr-1 h-4 w-4" />
          Back to parts
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left Column: Form & Inventory Snapshot */}
        <div className="lg:col-span-1 space-y-6">
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-900/5 dark:bg-zinc-900 dark:ring-zinc-800">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Inventory Status</h2>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-1">
              <div className="flex flex-col">
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">On Hand</dt>
                <dd className="mt-1 text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">{onHand}</dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Reserved</dt>
                <dd className="mt-1 text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">{reserved}</dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Available</dt>
                <dd className={`mt-1 text-2xl font-semibold tracking-tight ${isLow ? 'text-rose-600 dark:text-rose-400' : 'text-indigo-600 dark:text-indigo-400'}`}>{available}</dd>
              </div>
            </dl>
          </div>

          <PartForm part={{
            id: part.id,
            sku: part.sku,
            name: part.name,
            description: part.description,
            manufacturer: part.manufacturer,
            manufacturerPartNumber: part.manufacturerPartNumber,
            binLocation: part.binLocation,
            unitOfMeasure: part.unitOfMeasure,
            unitCost: Number(part.unitCost),
            reorderPoint: Number(part.reorderPoint),
            active: part.active,
          }} />
        </div>

        {/* Right Column: Ledger and Holds */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-900/5 dark:bg-zinc-900 dark:ring-zinc-800">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Active Reservations</h2>
            {part.reservations.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No active reservations.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-300 dark:divide-zinc-700">
                  <thead>
                    <tr>
                      <th className="py-2 text-left text-xs font-semibold text-gray-900 dark:text-gray-200">Date/Time</th>
                      <th className="py-2 text-left text-xs font-semibold text-gray-900 dark:text-gray-200">Work Order</th>
                      <th className="py-2 text-left text-xs font-semibold text-gray-900 dark:text-gray-200">User</th>
                      <th className="py-2 text-right text-xs font-semibold text-gray-900 dark:text-gray-200">Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                    {part.reservations.map((res) => (
                      <tr key={res.id}>
                        <td className="whitespace-nowrap py-2 text-sm text-gray-500 dark:text-gray-400">
                          {format(new Date(res.reservedAt), "MMM d, yyyy HH:mm")}
                        </td>
                        <td className="whitespace-nowrap py-2 text-sm text-gray-900 dark:text-gray-300">
                          <Link href={`/work-orders/${res.workOrderId}`} className="text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
                            {res.workOrder.workOrderNumber}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap py-2 text-sm text-gray-500 dark:text-gray-400">
                          {res.reservedByUser?.email || "Unknown"}
                        </td>
                        <td className="whitespace-nowrap py-2 text-sm text-right font-medium text-gray-900 dark:text-gray-300">
                          {Number(res.quantity)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-900/5 dark:bg-zinc-900 dark:ring-zinc-800">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Transaction Ledger</h2>
            {part.transactions.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No transactions recorded yet.</p>
            ) : (
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-300 dark:divide-zinc-700">
                  <thead className="sticky top-0 bg-white dark:bg-zinc-900">
                    <tr>
                      <th className="py-2 text-left text-xs font-semibold text-gray-900 dark:text-gray-200">Date/Time</th>
                      <th className="py-2 text-left text-xs font-semibold text-gray-900 dark:text-gray-200">Type</th>
                      <th className="py-2 text-right text-xs font-semibold text-gray-900 dark:text-gray-200">Qty ±</th>
                      <th className="py-2 text-left text-xs font-semibold text-gray-900 dark:text-gray-200 px-4">User</th>
                      <th className="py-2 text-left text-xs font-semibold text-gray-900 dark:text-gray-200">Note / Ref</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                    {part.transactions.map((tx) => (
                      <tr key={tx.id}>
                        <td className="whitespace-nowrap py-2 text-sm text-gray-500 dark:text-gray-400">
                          {format(new Date(tx.occurredAt), "MMM d, HH:mm")}
                        </td>
                        <td className="whitespace-nowrap py-2 text-sm text-gray-900 dark:text-gray-300">
                          <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 dark:bg-zinc-800 dark:text-gray-400 dark:ring-zinc-700">
                            {tx.type}
                          </span>
                        </td>
                        <td className="whitespace-nowrap py-2 text-sm text-right font-medium text-gray-900 dark:text-gray-300">
                          {Number(tx.quantity) > 0 && tx.type === 'RECEIVE' ? '+' : ''}{Number(tx.quantity)}
                        </td>
                        <td className="whitespace-nowrap py-2 text-sm text-gray-500 dark:text-gray-400 px-4">
                          {tx.createdByUser?.email?.split('@')[0] || "System"}
                        </td>
                        <td className="whitespace-nowrap py-2 text-sm text-gray-500 dark:text-gray-400 truncate max-w-[150px]" title={tx.note || tx.reference || ""}>
                          {tx.note || tx.reference || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
