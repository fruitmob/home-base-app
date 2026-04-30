import Link from "next/link";
import { notFound } from "next/navigation";
import { ArchiveButton } from "@/components/core/ArchiveButton";
import { PricebookEntryList } from "@/components/sales/PricebookEntryList";
import { PricebookForm } from "@/components/sales/PricebookForm";
import { toNumber } from "@/lib/core/money";
import { canWriteCatalog } from "@/lib/core/permissions";
import { requirePageUser } from "@/lib/core/pageAuth";
import { db } from "@/lib/db";

type PricebookDetailPageProps = {
  params: {
    id: string;
  };
};

export default async function PricebookDetailPage({ params }: PricebookDetailPageProps) {
  const user = await requirePageUser();
  const canMutate = canWriteCatalog(user.role);
  const pricebook = await db.pricebook.findFirst({
    where: { id: params.id, deletedAt: null },
    include: {
      entries: {
        where: { deletedAt: null },
        include: { product: { select: { id: true, sku: true, name: true, active: true } } },
        orderBy: [{ createdAt: "asc" }],
      },
    },
  });

  if (!pricebook) {
    notFound();
  }

  const products = await db.product.findMany({
    where: { deletedAt: null, active: true },
    select: { id: true, sku: true, name: true, defaultUnitPrice: true },
    orderBy: [{ name: "asc" }],
    take: 500,
  });

  const entries = pricebook.entries.map((entry) => ({
    id: entry.id,
    productId: entry.productId,
    unitPrice: toNumber(entry.unitPrice),
    effectiveFrom: entry.effectiveFrom?.toISOString() ?? null,
    effectiveTo: entry.effectiveTo?.toISOString() ?? null,
    product: entry.product,
  }));

  const initial = {
    id: pricebook.id,
    name: pricebook.name,
    description: pricebook.description,
    isDefault: pricebook.isDefault,
    active: pricebook.active,
  };

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link
            href="/catalog/pricebooks"
            className="text-sm font-bold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            Back to pricebooks
          </Link>
          <h2 className="mt-3 text-4xl font-black tracking-tight text-slate-950 dark:text-white">
            {pricebook.name}
            {pricebook.isDefault ? (
              <span className="ml-3 rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold uppercase text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                Default
              </span>
            ) : null}
          </h2>
          <p className="mt-3 text-slate-500 dark:text-slate-400">
            {pricebook.description ?? "No description"}
          </p>
        </div>
        <ArchiveButton
          endpoint={`/api/pricebooks/${pricebook.id}`}
          label="pricebook"
          redirectTo="/catalog/pricebooks"
          canMutate={canMutate && !pricebook.isDefault}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <article className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-5 text-xl font-black tracking-tight text-slate-950 dark:text-white">
              Pricebook entries
            </h3>
            <PricebookEntryList
              pricebookId={pricebook.id}
              entries={entries}
              products={products.map((product) => ({
                id: product.id,
                sku: product.sku,
                name: product.name,
                defaultUnitPrice: toNumber(product.defaultUnitPrice),
              }))}
              canMutate={canMutate}
            />
          </div>
        </article>

        <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
            Pricebook record
          </h3>
          <div className="mt-6">
            <PricebookForm initial={initial} canMutate={canMutate} />
          </div>
        </aside>
      </div>
    </section>
  );
}
