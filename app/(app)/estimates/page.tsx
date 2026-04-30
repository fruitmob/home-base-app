import { requirePageUser } from "@/lib/core/pageAuth";
import { db } from "@/lib/db";
import Link from "next/link";
import { PlusIcon, ClipboardDocumentListIcon } from "@heroicons/react/24/outline";
import { formatCurrency } from "@/lib/core/money";

export default async function EstimatesPage({
  searchParams,
}: {
  searchParams: { search?: string; status?: string };
}) {
  await requirePageUser();

  const search = searchParams.search;
  const statusFilter = searchParams.status;

  const where: any /* eslint-disable-line @typescript-eslint/no-explicit-any */ = { deletedAt: null };
  if (search) {
    where.OR = [
      { estimateNumber: { contains: search, mode: "insensitive" } },
      { title: { contains: search, mode: "insensitive" } },
      { customer: { firstName: { contains: search, mode: "insensitive" } } },
      { customer: { lastName: { contains: search, mode: "insensitive" } } },
    ];
  }

  if (statusFilter) {
    where.status = statusFilter;
  }

  const estimates = await db.estimate.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { firstName: true, lastName: true, displayName: true } },
      vehicle: { select: { make: true, model: true, year: true } },
    },
    take: 50,
  });

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Estimates</h1>
          <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
            A list of all pre-work quotes and estimates.
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <Link
            href="/estimates/new"
            className="flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <PlusIcon className="h-4 w-4" />
            New Estimate
          </Link>
        </div>
      </div>

      <div className="mt-8 flex flex-col">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg dark:ring-zinc-800">
              <table className="min-w-full divide-y divide-gray-300 dark:divide-zinc-700">
                <thead className="bg-gray-50 dark:bg-zinc-800">
                  <tr>
                    <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 dark:text-zinc-300">
                      Estimate
                    </th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-zinc-300">
                      Customer
                    </th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-zinc-300">
                      Vehicle
                    </th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-zinc-300">
                      Total
                    </th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-zinc-300">
                      Status
                    </th>
                    <th className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">View</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white dark:divide-zinc-700 dark:bg-zinc-900">
                  {estimates.map((est) => (
                    <tr key={est.id}>
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 dark:text-zinc-100">
                        {est.estimateNumber}
                        <div className="text-xs font-normal text-gray-500 dark:text-zinc-400">
                          {est.title}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-zinc-300">
                        {est.customer.displayName || `${est.customer.firstName} ${est.customer.lastName}`}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-zinc-300">
                        {est.vehicle ? `${est.vehicle.year} ${est.vehicle.make} ${est.vehicle.model}` : "N/A"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900 dark:text-zinc-100">
                        {formatCurrency(Number(est.total))}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                          est.status === "APPROVED" ? "bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-500/10 dark:text-green-400 dark:ring-green-500/20" :
                          est.status === "DRAFT" ? "bg-gray-50 text-gray-700 ring-gray-600/20 dark:bg-zinc-500/10 dark:text-zinc-400 dark:ring-zinc-500/20" :
                          est.status === "DECLINED" ? "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/20" :
                          "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20"
                        }`}>
                          {est.status}
                        </span>
                      </td>
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <Link
                          href={`/estimates/${est.id}`}
                          className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                        >
                          View<span className="sr-only">, {est.estimateNumber}</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {estimates.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-sm text-gray-500 dark:text-zinc-400">
                        <ClipboardDocumentListIcon className="mx-auto h-8 w-8 text-gray-400 dark:text-zinc-500 mb-2" />
                        No estimates found.
                      </td>
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
