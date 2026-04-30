import Link from "next/link";
import { requirePageUser } from "@/lib/core/pageAuth";
import { db } from "@/lib/db";
import { format } from "date-fns";

export default async function WarrantyPage() {
  await requirePageUser();

  const claims = await db.warrantyClaim.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      workOrder: { select: { workOrderNumber: true } },
      vendor: { select: { name: true } },
    },
    take: 50,
  });

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-black leading-6 text-slate-950 dark:text-white">Warranty Claims</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            A list of all documented warranty claims submitted to vendors or internal work orders.
          </p>
        </div>
      </div>
      
      <div className="mt-8 flow-root">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300 dark:divide-zinc-700">
                <thead className="bg-slate-50 dark:bg-zinc-800">
                  <tr>
                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-slate-900 dark:text-zinc-100 sm:pl-6">
                      Claim #
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900 dark:text-zinc-100">
                      Title
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900 dark:text-zinc-100">
                      Work Order
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900 dark:text-zinc-100">
                      Status
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900 dark:text-zinc-100">
                      Vendor
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900 dark:text-zinc-100">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-zinc-700 bg-white dark:bg-zinc-900">
                  {claims.map((claim) => (
                    <tr key={claim.id}>
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-slate-900 dark:text-zinc-100 sm:pl-6">
                        <Link href={`/warranty/${claim.id}`} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400">
                          {claim.claimNumber || claim.id.slice(-8)}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500 dark:text-zinc-400">
                        {claim.title}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500 dark:text-zinc-400">
                        <Link href={`/work-orders/${claim.workOrderId}`} className="text-indigo-600 hover:underline">
                          {claim.workOrder.workOrderNumber}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500 dark:text-zinc-400">
                        <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${claim.status === "RECOVERED" ? "bg-green-100 text-green-800 dark:bg-green-500/10 dark:text-green-400" : claim.status === "DENIED" ? "bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-400" : "bg-yellow-100 text-yellow-800 dark:bg-yellow-500/10 dark:text-yellow-400"}`}>
                          {claim.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500 dark:text-zinc-400">
                        {claim.vendor?.name || "Internal"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500 dark:text-zinc-400">
                        {format(claim.createdAt, "MMM d, yyyy")}
                      </td>
                    </tr>
                  ))}
                  {claims.length === 0 && (
                     <tr>
                      <td colSpan={6} className="py-4 text-center text-sm text-gray-500">No warranty claims found.</td>
                     </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
