import Link from "next/link";
import { Prisma } from "@/generated/prisma/client";
import { CustomerForm } from "@/components/core/CustomerForm";
import { canWriteCustomerEntities } from "@/lib/core/permissions";
import { requirePageUser } from "@/lib/core/pageAuth";
import { db } from "@/lib/db";

type CustomersPageProps = {
  searchParams?: {
    q?: string;
  };
};

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const user = await requirePageUser();
  const canMutate = canWriteCustomerEntities(user.role);
  const query = searchParams?.q?.trim() ?? "";
  const customers = await db.customer.findMany({
    where: {
      deletedAt: null,
      ...(query
        ? {
          OR: [
            { displayName: { contains: query, mode: Prisma.QueryMode.insensitive } },
            { companyName: { contains: query, mode: Prisma.QueryMode.insensitive } },
            { firstName: { contains: query, mode: Prisma.QueryMode.insensitive } },
            { lastName: { contains: query, mode: Prisma.QueryMode.insensitive } },
            { email: { contains: query, mode: Prisma.QueryMode.insensitive } },
            { phone: { contains: query, mode: Prisma.QueryMode.insensitive } },
          ],
        }
        : {}),
    },
    include: {
      _count: {
        select: {
          vehicles: true,
          contacts: true,
        },
      },
    },
    orderBy: [{ displayName: "asc" }],
    take: 100,
  });

  return (
    <section className="mx-auto max-w-7xl space-y-8">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="bg-[radial-gradient(circle_at_top_left,_#bae6fd,_transparent_30%),linear-gradient(135deg,_#f8fafc_0%,_#e2e8f0_100%)] px-8 py-10 dark:bg-[radial-gradient(circle_at_top_left,_rgba(14,116,144,0.45),_transparent_30%),linear-gradient(135deg,_#020617_0%,_#0f172a_100%)]">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">
            Core Entities
          </p>
          <h2 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">
            Customers are the anchor for every vehicle and work order.
          </h2>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
            Keep the canonical account record tidy now so sales, service, portal, reporting, and AI
            have one reliable place to attach future work.
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <form className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Search Customers
              </span>
              <input
                name="q"
                defaultValue={query}
                placeholder="Name, email, or phone"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-slate-800"
              />
            </label>
          </form>

          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            {customers.length === 0 ? (
              <p className="p-8 text-slate-500 dark:text-slate-400">No customers found.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {customers.map((customer) => (
                  <Link
                    key={customer.id}
                    href={`/customers/${customer.id}`}
                    className="block p-5 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-lg font-black text-slate-950 dark:text-white">
                          {customer.displayName}
                        </p>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          {[customer.email, customer.phone, customer.isWalkIn ? "Walk-in" : null]
                            .filter(Boolean)
                            .join(" | ") || "No contact details"}
                        </p>
                      </div>
                      <div className="flex gap-2 text-xs font-bold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">
                        <span>{customer._count.contacts} contacts</span>
                        <span>{customer._count.vehicles} vehicles</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
            New Customer
          </h3>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Start with the essentials. Contacts, addresses, and vehicles can be added on the detail page.
          </p>
          <div className="mt-6">
            <CustomerForm canMutate={canMutate} compact />
          </div>
        </aside>
      </div>
    </section>
  );
}
