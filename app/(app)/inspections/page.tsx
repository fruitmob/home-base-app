import Link from "next/link";
import { requirePageUser } from "@/lib/core/pageAuth";
import { db } from "@/lib/db";
import { format } from "date-fns";

export default async function InspectionsPage() {
  await requirePageUser();

  const inspections = await db.arrivalInspection.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      customer: true,
      vehicle: true,
      performedByUser: true,
    },
    take: 50,
  });

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-black leading-6 text-slate-950 dark:text-white">Inspections</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            A list of all documented arrival and PDI checklists.
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
                      ID
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900 dark:text-zinc-100">
                      Type
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900 dark:text-zinc-100">
                      Customer / Vehicle
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900 dark:text-zinc-100">
                      Status
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900 dark:text-zinc-100">
                      Inspector
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900 dark:text-zinc-100">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-zinc-700 bg-white dark:bg-zinc-900">
                  {inspections.map((insp) => (
                    <tr key={insp.id}>
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-slate-900 dark:text-zinc-100 sm:pl-6">
                        <Link href={`/inspections/${insp.id}`} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400">
                          {insp.id.slice(-8)}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500 dark:text-zinc-400">
                        {insp.type}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500 dark:text-zinc-400">
                        {insp.customer.firstName} {insp.customer.lastName} <br/>
                        <span className="text-xs">{insp.vehicle.year} {insp.vehicle.make} {insp.vehicle.model}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500 dark:text-zinc-400">
                        <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${insp.status === "COMPLETE" ? "bg-green-100 text-green-800 dark:bg-green-500/10 dark:text-green-400" : "bg-yellow-100 text-yellow-800 dark:bg-yellow-500/10 dark:text-yellow-400"}`}>
                          {insp.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500 dark:text-zinc-400">
                        {insp.performedByUser?.email || "Unknown"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500 dark:text-zinc-400">
                        {format(insp.createdAt, "MMM d, yyyy")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
