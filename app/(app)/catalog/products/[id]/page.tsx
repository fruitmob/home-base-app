import Link from "next/link";
import { notFound } from "next/navigation";
import { ArchiveButton } from "@/components/core/ArchiveButton";
import { ProductForm } from "@/components/sales/ProductForm";
import { toNumber, formatCurrency } from "@/lib/core/money";
import { canWriteCatalog } from "@/lib/core/permissions";
import { requirePageUser } from "@/lib/core/pageAuth";
import { db } from "@/lib/db";

type ProductDetailPageProps = {
  params: {
    id: string;
  };
};

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const user = await requirePageUser();
  const canMutate = canWriteCatalog(user.role);
  const product = await db.product.findFirst({
    where: { id: params.id, deletedAt: null },
    include: {
      pricebookEntries: {
        where: { deletedAt: null },
        include: { pricebook: { select: { id: true, name: true, isDefault: true } } },
        orderBy: [{ createdAt: "asc" }],
      },
    },
  });

  if (!product) {
    notFound();
  }

  const initial = {
    id: product.id,
    sku: product.sku,
    name: product.name,
    description: product.description,
    family: product.family,
    isLabor: product.isLabor,
    taxable: product.taxable,
    active: product.active,
    defaultUnitPrice: toNumber(product.defaultUnitPrice),
    defaultCost: product.defaultCost == null ? null : toNumber(product.defaultCost),
  };

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link
            href="/catalog"
            className="text-sm font-bold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            Back to catalog
          </Link>
          <h2 className="mt-3 text-4xl font-black tracking-tight text-slate-950 dark:text-white">
            {product.name}
          </h2>
          <p className="mt-3 text-slate-500 dark:text-slate-400">
            SKU {product.sku}
            {product.family ? ` | ${product.family}` : ""}
            {product.isLabor ? " | Labor" : ""}
          </p>
        </div>
        <ArchiveButton
          endpoint={`/api/products/${product.id}`}
          label="product"
          redirectTo="/catalog"
          canMutate={canMutate}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-5 text-xl font-black tracking-tight text-slate-950 dark:text-white">
            Product record
          </h3>
          <ProductForm initial={initial} canMutate={canMutate} />
        </article>

        <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
            Pricebook overrides
          </h3>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Per-pricebook unit prices that beat the default. Missing entries fall back to{" "}
            {formatCurrency(product.defaultUnitPrice)}.
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {product.pricebookEntries.length === 0 ? (
              <li className="rounded-2xl border border-dashed border-slate-200 p-4 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                No pricebook overrides yet.
              </li>
            ) : (
              product.pricebookEntries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 px-3 py-2 dark:border-slate-800"
                >
                  <Link
                    href={`/catalog/pricebooks/${entry.pricebook.id}`}
                    className="font-bold text-slate-950 dark:text-white"
                  >
                    {entry.pricebook.name}
                    {entry.pricebook.isDefault ? " (default)" : ""}
                  </Link>
                  <span className="text-slate-700 dark:text-slate-200">
                    {formatCurrency(entry.unitPrice)}
                  </span>
                </li>
              ))
            )}
          </ul>
        </aside>
      </div>
    </section>
  );
}
