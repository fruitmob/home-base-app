import Link from "next/link";
import { PricebookForm } from "@/components/sales/PricebookForm";
import { canWriteCatalog } from "@/lib/core/permissions";
import { requirePageUser } from "@/lib/core/pageAuth";
import { db } from "@/lib/db";

export default async function PricebooksPage() {
  const user = await requirePageUser();
  const canMutate = canWriteCatalog(user.role);
  const pricebooks = await db.pricebook.findMany({
    where: { deletedAt: null },
    include: {
      _count: { select: { entries: { where: { deletedAt: null } } } },
    },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  return (
    <section className="mx-auto max-w-7xl space-y-8">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="bg-[radial-gradient(circle_at_top_left,_#c7d2fe,_transparent_35%),linear-gradient(135deg,_#f8fafc_0%,_#e2e8f0_100%)] px-8 py-10 dark:bg-[radial-gradient(circle_at_top_left,_rgba(67,56,202,0.5),_transparent_35%),linear-gradient(135deg,_#020617_0%,_#0f172a_100%)]">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">
            Catalog - Pricebooks
          </p>
          <h2 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">
            Price tiers that quotes and work orders reach for.
          </h2>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
            One pricebook is always the default. Customers can override it to get tier pricing. Quotes
            resolve per-line prices in the order: customer override, shop default, product default.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/catalog"
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Back to products
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {pricebooks.length === 0 ? (
            <p className="p-8 text-slate-500 dark:text-slate-400">No pricebooks yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {pricebooks.map((pricebook) => (
                <li key={pricebook.id}>
                  <Link
                    href={`/catalog/pricebooks/${pricebook.id}`}
                    className="block p-5 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-lg font-black text-slate-950 dark:text-white">
                          {pricebook.name}
                          {pricebook.isDefault ? (
                            <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold uppercase text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                              Default
                            </span>
                          ) : null}
                          {!pricebook.active ? (
                            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              Inactive
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          {pricebook.description ?? "No description"}
                        </p>
                      </div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        {pricebook._count.entries} entr{pricebook._count.entries === 1 ? "y" : "ies"}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
            New pricebook
          </h3>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Set isDefault to move the shop default. Only one pricebook can be the default at a time.
          </p>
          <div className="mt-6">
            <PricebookForm canMutate={canMutate} />
          </div>
        </aside>
      </div>
    </section>
  );
}
