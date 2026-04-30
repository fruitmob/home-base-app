import Link from "next/link";
import { Prisma } from "@/generated/prisma/client";
import { ProductForm } from "@/components/sales/ProductForm";
import { formatCurrency } from "@/lib/core/money";
import { canWriteCatalog } from "@/lib/core/permissions";
import { requirePageUser } from "@/lib/core/pageAuth";
import { db } from "@/lib/db";

type CatalogPageProps = {
  searchParams?: {
    q?: string;
    family?: string;
    active?: string;
  };
};

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const user = await requirePageUser();
  const canMutate = canWriteCatalog(user.role);
  const query = searchParams?.q?.trim() ?? "";
  const family = searchParams?.family?.trim() ?? "";
  const activeParam = searchParams?.active ?? "";

  const where: Prisma.ProductWhereInput = { deletedAt: null };

  if (query) {
    where.OR = [
      { sku: { contains: query, mode: Prisma.QueryMode.insensitive } },
      { name: { contains: query, mode: Prisma.QueryMode.insensitive } },
      { description: { contains: query, mode: Prisma.QueryMode.insensitive } },
    ];
  }

  if (family) {
    where.family = family;
  }

  if (activeParam === "true" || activeParam === "false") {
    where.active = activeParam === "true";
  }

  const [products, families, pricebookCount] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: [{ name: "asc" }],
      take: 200,
    }),
    db.product.findMany({
      where: { deletedAt: null, family: { not: null } },
      distinct: ["family"],
      select: { family: true },
      orderBy: { family: "asc" },
    }),
    db.pricebook.count({ where: { deletedAt: null } }),
  ]);

  return (
    <section className="mx-auto max-w-7xl space-y-8">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="bg-[radial-gradient(circle_at_top_right,_#bfdbfe,_transparent_35%),linear-gradient(135deg,_#f8fafc_0%,_#e2e8f0_100%)] px-8 py-10 dark:bg-[radial-gradient(circle_at_top_right,_rgba(30,64,175,0.5),_transparent_35%),linear-gradient(135deg,_#020617_0%,_#0f172a_100%)]">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">
            Catalog
          </p>
          <h2 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">
            Products and pricebooks power every quote you write.
          </h2>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
            Keep SKUs, labor operations, and pricing tiers organized so quotes, work orders, and
            invoices later reach for a consistent source of truth.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/catalog/pricebooks"
              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white dark:bg-white dark:text-slate-950"
            >
              {pricebookCount} pricebook{pricebookCount === 1 ? "" : "s"} -&gt;
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <form className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-end">
            <label className="flex-1">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Search products
              </span>
              <input
                name="q"
                defaultValue={query}
                placeholder="SKU, name, or description"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-slate-800"
              />
            </label>
            <label className="md:w-60">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Family
              </span>
              <select
                name="family"
                defaultValue={family}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-slate-800"
              >
                <option value="">All families</option>
                {families.map((row) =>
                  row.family ? (
                    <option key={row.family} value={row.family}>
                      {row.family}
                    </option>
                  ) : null,
                )}
              </select>
            </label>
            <label className="md:w-48">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Status
              </span>
              <select
                name="active"
                defaultValue={activeParam}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-slate-800"
              >
                <option value="">Any</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </label>
            <button
              type="submit"
              className="rounded-full border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Apply
            </button>
          </form>

          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            {products.length === 0 ? (
              <p className="p-8 text-slate-500 dark:text-slate-400">No products found.</p>
            ) : (
              <table className="w-full divide-y divide-slate-100 text-sm dark:divide-slate-800">
                <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3">SKU</th>
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">Family</th>
                    <th className="px-5 py-3">Default Price</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                      <td className="px-5 py-4 font-bold text-slate-950 dark:text-white">
                        <Link href={`/catalog/products/${product.id}`}>{product.sku}</Link>
                      </td>
                      <td className="px-5 py-4 text-slate-700 dark:text-slate-200">
                        <Link href={`/catalog/products/${product.id}`}>{product.name}</Link>
                      </td>
                      <td className="px-5 py-4 text-slate-500 dark:text-slate-400">
                        {product.family ?? "-"}
                      </td>
                      <td className="px-5 py-4 text-slate-700 dark:text-slate-200">
                        {formatCurrency(product.defaultUnitPrice)}
                      </td>
                      <td className="px-5 py-4 text-xs font-bold uppercase tracking-[0.15em]">
                        {product.active ? (
                          <span className="text-emerald-600 dark:text-emerald-400">Active</span>
                        ) : (
                          <span className="text-slate-400">Inactive</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
            New product
          </h3>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Add a part, fluid, or labor operation. Quotes will resolve prices against the active
            pricebook first and fall back to the default unit price.
          </p>
          <div className="mt-6">
            <ProductForm canMutate={canMutate} />
          </div>
        </aside>
      </div>
    </section>
  );
}
