import Link from "next/link";
import { Role } from "@/generated/prisma/client";
import { WorkOrderForm } from "@/components/shop/WorkOrderForm";
import { canWriteWorkOrders } from "@/lib/core/permissions";
import { requirePageUser } from "@/lib/core/pageAuth";
import { db } from "@/lib/db";

export default async function NewWorkOrderPage() {
  const user = await requirePageUser();
  const canMutate = canWriteWorkOrders(user.role);
  const [customers, vehicles, users, bays] = await Promise.all([
    db.customer.findMany({
      where: { deletedAt: null },
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" },
      take: 300,
    }),
    db.vehicle.findMany({
      where: { deletedAt: null },
      select: { id: true, customerId: true, year: true, make: true, model: true, unitNumber: true },
      orderBy: [{ updatedAt: "desc" }],
      take: 300,
    }),
    db.user.findMany({
      where: {
        deletedAt: null,
        role: {
          in: [
            Role.OWNER,
            Role.ADMIN,
            Role.MANAGER,
            Role.SERVICE_MANAGER,
            Role.SERVICE_WRITER,
            Role.TECH,
          ],
        },
      },
      select: { id: true, email: true, role: true },
      orderBy: { email: "asc" },
      take: 200,
    }),
    db.bay.findMany({
      where: { deletedAt: null, active: true },
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Link href="/work-orders" className="text-sm font-bold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
          Back to work orders
        </Link>
        <h2 className="mt-3 text-4xl font-black tracking-tight text-slate-950 dark:text-white">
          New Work Order
        </h2>
      </div>

      <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <WorkOrderForm
          customers={customers}
          vehicles={vehicles}
          users={users}
          bays={bays}
          canMutate={canMutate}
        />
      </article>
    </section>
  );
}
