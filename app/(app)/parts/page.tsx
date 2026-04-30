import { requirePageUser } from "@/lib/core/pageAuth";
import { db } from "@/lib/db";
import Link from "next/link";
import { PlusIcon } from "@heroicons/react/24/outline";

export const dynamic = "force-dynamic";

export default async function PartsListPage({
  searchParams,
}: {
  searchParams: { lowStock?: string; search?: string };
}) {
  await requirePageUser();

  const isLowStock = searchParams.lowStock === "true";
  const search = searchParams.search;

  let where: any /* eslint-disable-line @typescript-eslint/no-explicit-any */ = { deletedAt: null };

  if (search) {
    where = {
      ...where,
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
        { manufacturerPartNumber: { contains: search, mode: "insensitive" } },
      ],
    };
  }

  const parts = await db.part.findMany({
    where,
    orderBy: { name: "asc" },
  });

  const filteredParts = isLowStock
    ? parts.filter(
        (p) => Number(p.quantityOnHand) - Number(p.quantityReserved) <= Number(p.reorderPoint)
      )
    : parts;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Part Inventory</h1>
          <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
            A list of all parts in the shop, including their SKU, location, and quantities.
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <Link
            href="/parts/new"
            className="inline-flex items-center gap-x-1.5 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <PlusIcon className="-ml-0.5 h-5 w-5" aria-hidden="true" />
            New Part
          </Link>
        </div>
      </div>
      
      <div className="mt-4 border-b border-gray-200 pb-4 dark:border-gray-700">
        <form className="flex max-w-sm gap-2">
          <input
            type="text"
            name="search"
            defaultValue={search || ""}
            placeholder="Search parts..."
            className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-zinc-800 dark:text-white dark:ring-gray-700"
          />
          <button
            type="submit"
            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-zinc-800 dark:text-gray-300 dark:ring-gray-700 dark:hover:bg-zinc-700"
          >
            Search
          </button>

          {isLowStock ? (
             <Link
             href="/parts"
             className="inline-flex items-center rounded-md bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 ring-1 ring-inset ring-rose-600/20 hover:bg-rose-100"
           >
             Clear Low Stock
           </Link>
          ) : (
            <Link
              href="/parts?lowStock=true"
              className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-zinc-800 dark:text-gray-300 dark:ring-gray-700 dark:hover:bg-zinc-700 whitespace-nowrap"
            >
              Low Stock Only
            </Link>
          )}
        </form>
      </div>

      <div className="mt-8 flow-root">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg dark:ring-white/10 border border-gray-200 dark:border-zinc-800">
              <table className="min-w-full divide-y divide-gray-300 dark:divide-zinc-700">
                <thead className="bg-gray-50 dark:bg-zinc-800">
                  <tr>
                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 dark:text-gray-200">
                      SKU / Name
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
                      Location
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
                      MPN
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-gray-200">
                      On Hand
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-gray-200">
                      Reserved
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-gray-200">
                      Available
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white dark:divide-zinc-700 dark:bg-zinc-900">
                  {filteredParts.length === 0 ? (
                     <tr>
                     <td colSpan={6} className="py-8 pl-4 pr-3 text-sm text-gray-500 text-center sm:pl-6 dark:text-gray-400">
                       No parts found.
                     </td>
                   </tr>
                  ) : (
                    filteredParts.map((part) => {
                      const onHand = Number(part.quantityOnHand);
                      const reserved = Number(part.quantityReserved);
                      const available = onHand - reserved;
                      const isLow = available <= Number(part.reorderPoint);

                      return (
                        <tr key={part.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800">
                          <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 dark:text-gray-200">
                            <Link href={`/parts/${part.id}`} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300">
                              <div className="font-semibold">{part.sku}</div>
                              <div className="text-gray-500 font-normal dark:text-gray-400">{part.name}</div>
                            </Link>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                            {part.binLocation || "Unassigned"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                            {part.manufacturerPartNumber || "-"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-right text-gray-500 dark:text-gray-400">
                            {onHand}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-right text-gray-500 dark:text-gray-400">
                            {reserved}
                          </td>
                          <td className={`whitespace-nowrap px-3 py-4 text-sm text-right font-medium ${isLow ? 'text-rose-600 dark:text-rose-400' : 'text-gray-900 dark:text-gray-200'}`}>
                            {available}
                          </td>
                        </tr>
                      );
                    })
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
