import Link from "next/link";
import { PlusIcon } from "@heroicons/react/24/outline";
import { requirePageUser } from "@/lib/core/pageAuth";
import { assertWorkOrderWriteRole } from "@/lib/core/api";
import { ArchiveButton } from "@/components/core/ArchiveButton";
import { db } from "@/lib/db";

export const metadata = {
  title: "Bays | Home Base",
};

export default async function BaysPage() {
  const user = await requirePageUser();

  let canMutate = true;
  try {
    assertWorkOrderWriteRole(user);
  } catch {
    canMutate = false;
  }

  const bays = await db.bay.findMany({
    where: { deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: {
        select: {
          workOrders: {
            where: { status: { not: "CLOSED" }, deletedAt: null },
          },
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between bg-[radial-gradient(circle_at_top_left,_#bae6fd,_transparent_30%),linear-gradient(135deg,_#f8fafc_0%,_#e2e8f0_100%)] px-8 py-10 dark:bg-[radial-gradient(circle_at_top_left,_rgba(14,116,144,0.45),_transparent_30%),linear-gradient(135deg,_#020617_0%,_#0f172a_100%)]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">
              Shop Configuration
            </p>
            <h2 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">
              Bays
            </h2>
          </div>
          {canMutate && (
            <Link
              href="/shop/bays/new"
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 font-black text-white shadow-sm hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              <PlusIcon className="h-5 w-5" />
              New Bay
            </Link>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        {bays.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            No bays configured yet.
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-800">
            {bays.map((bay) => (
              <li
                key={bay.id}
                className="flex items-center justify-between gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={canMutate ? `/shop/bays/${bay.id}` : "#"}
                      className="font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      {bay.name}
                    </Link>
                    {!bay.active && (
                      <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20">
                        Inactive
                      </span>
                    )}
                  </div>
                  {bay.description && (
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {bay.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {bay._count.workOrders} active work orders
                  </div>
                  {canMutate && (
                    <ArchiveButton
                      endpoint={`/api/bays/${bay.id}`}
                      label="bay"
                      canMutate={canMutate}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
