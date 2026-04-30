import Link from "next/link";
import { notFound } from "next/navigation";
import { CaseForm } from "@/components/sales/CaseForm";
import { CASE_WRITE_ROLES } from "@/lib/core/permissions";
import { requirePageUser } from "@/lib/core/pageAuth";
import { db } from "@/lib/db";

export default async function NewCasePage() {
  const user = await requirePageUser();
  const canMutate = (CASE_WRITE_ROLES as readonly string[]).includes(user.role);

  if (!canMutate) {
    notFound();
  }

  const [customers, vehicles, users] = await Promise.all([
    db.customer.findMany({
      where: { deletedAt: null },
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" },
      take: 500,
    }),
    db.vehicle.findMany({
      where: { deletedAt: null },
      select: { id: true, year: true, make: true, model: true, unitNumber: true },
      orderBy: [{ unitNumber: "asc" }, { createdAt: "desc" }],
      take: 500,
    }),
    db.user.findMany({
      where: { deletedAt: null },
      select: { id: true, email: true },
      orderBy: { email: "asc" },
    }),
  ]);

  return (
    <section className="mx-auto max-w-4xl space-y-8">
      <Link
        href="/cases"
        className="inline-flex rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
      >
        &larr; Cases
      </Link>

      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-12">
        <h2 className="mb-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">
          New Case
        </h2>
        <p className="mb-8 max-w-2xl text-slate-500 dark:text-slate-400">
          Capture the customer concern and assign a clear owner for follow-through.
        </p>

        <CaseForm
          canMutate={canMutate}
          customers={customers.map((customer) => ({
            id: customer.id,
            label: customer.displayName,
          }))}
          vehicles={vehicles.map((vehicle) => ({
            id: vehicle.id,
            label: [vehicle.unitNumber, vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" "),
          }))}
          users={users.map((assignee) => ({
            id: assignee.id,
            label: assignee.email,
          }))}
        />
      </div>
    </section>
  );
}
