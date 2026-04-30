import { requirePageUser } from "@/lib/core/pageAuth";
import { db } from "@/lib/db";
import Link from "next/link";
import { format } from "date-fns";
import { PlusIcon } from "@heroicons/react/24/outline";

export const metadata = { title: "Quote Templates | Home Base" };

export default async function QuoteTemplatesListPage() {
  await requirePageUser();

  const templates = await db.quoteTemplate.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Quote Templates</h1>
        <Link
          href="/quote-templates/new"
          className="bg-blue-600 text-white px-4 py-2 rounded shadow-sm hover:bg-blue-700 font-medium flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          Create Template
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
            {templates.map((template) => (
              <tr key={template.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <Link href={`/quote-templates/${template.id}`} className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                    {template.name}
                  </Link>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-md truncate">
                  {template.description || "-"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {format(template.createdAt, "MMM d, yyyy")}
                </td>
              </tr>
            ))}
            {templates.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                  No templates found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
