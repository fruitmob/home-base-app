import { requirePageUser } from "@/lib/core/pageAuth";
import { db } from "@/lib/db";
import Link from "next/link";
import { format } from "date-fns";
import { PlusIcon } from "@heroicons/react/24/outline";

export const metadata = { title: "Quotes | Home Base" };

export default async function QuotesListPage() {
  await requirePageUser();

  const quotes = await db.quote.findMany({
    where: { deletedAt: null },
    include: {
      customer: true,
      createdByUser: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const statusColors: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-800",
    SENT: "bg-blue-100 text-blue-800",
    ACCEPTED: "bg-green-100 text-green-800",
    DECLINED: "bg-red-100 text-red-800",
    EXPIRED: "bg-yellow-100 text-yellow-800",
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Quotes</h1>
        <Link
          href="/quotes/new"
          className="bg-blue-600 text-white px-4 py-2 rounded shadow-sm hover:bg-blue-700 font-medium flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          Create Quote
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Number</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
               <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
            {quotes.map((quote) => (
              <tr key={quote.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <Link href={`/quotes/${quote.id}`} className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                    {quote.quoteNumber}
                  </Link>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {quote.customer?.displayName || "-"}
                </td>
                 <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-medium">
                  ${Number(quote.total).toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[quote.status]}`}>
                    {quote.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {format(quote.createdAt, "MMM d, yyyy")}
                </td>
              </tr>
            ))}
            {quotes.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  No quotes found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
