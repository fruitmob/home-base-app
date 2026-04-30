import Link from "next/link";
import { notFound } from "next/navigation";
import { AddressList } from "@/components/core/AddressList";
import { ArchiveButton } from "@/components/core/ArchiveButton";
import { ContactList } from "@/components/core/ContactList";
import { CustomerForm } from "@/components/core/CustomerForm";
import { ActivityTimeline } from "@/components/sales/ActivityTimeline";
import { canWriteCustomerEntities } from "@/lib/core/permissions";
import { requirePageUser } from "@/lib/core/pageAuth";
import { db } from "@/lib/db";

type CustomerDetailPageProps = {
  params: {
    id: string;
  };
};

export default async function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  const user = await requirePageUser();
  const canMutate = canWriteCustomerEntities(user.role);
  const customer = await db.customer.findFirst({
    where: { id: params.id, deletedAt: null },
    include: {
      contacts: {
        where: { deletedAt: null },
        orderBy: [{ isPrimary: "desc" }, { displayName: "asc" }],
      },
      addresses: {
        where: { deletedAt: null },
        orderBy: [{ isPrimary: "desc" }, { type: "asc" }],
      },
      vehicles: {
        where: { deletedAt: null },
        orderBy: [{ updatedAt: "desc" }],
      },
      workOrders: {
        where: { deletedAt: null },
        orderBy: [{ createdAt: "desc" }],
        take: 8,
        select: {
          id: true,
          workOrderNumber: true,
          title: true,
          status: true,
          priority: true,
          createdAt: true,
        },
      },
    },
  });

  if (!customer) {
    notFound();
  }

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link href="/customers" className="text-sm font-bold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
            Back to customers
          </Link>
          <h2 className="mt-3 text-4xl font-black tracking-tight text-slate-950 dark:text-white">
            {customer.displayName}
          </h2>
          <p className="mt-3 text-slate-500 dark:text-slate-400">
            {[customer.email, customer.phone, customer.isWalkIn ? "Walk-in" : null]
              .filter(Boolean)
              .join(" | ") || "No contact details"}
          </p>
        </div>
        <ArchiveButton
          endpoint={`/api/customers/${customer.id}`}
          label="customer"
          redirectTo="/customers"
          canMutate={canMutate}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-5 text-xl font-black tracking-tight text-slate-950 dark:text-white">
              Customer Record
            </h3>
            <CustomerForm initial={customer} canMutate={canMutate} />
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <ContactList
              ownerType="customer"
              ownerId={customer.id}
              contacts={customer.contacts}
              canMutate={canMutate}
            />
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <AddressList
              ownerType="customer"
              ownerId={customer.id}
              addresses={customer.addresses}
              canMutate={canMutate}
            />
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-5 text-xl font-black tracking-tight text-slate-950 dark:text-white">
              Activity History
            </h3>
            <ActivityTimeline parentKey="customerId" parentId={customer.id} />
          </article>
        </div>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
              Vehicles
            </h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Active vehicles attached to this customer.
            </p>
            <div className="mt-5 space-y-3">
              {customer.vehicles.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  No vehicles yet.
                </p>
              ) : (
                customer.vehicles.map((vehicle) => (
                  <Link
                    key={vehicle.id}
                    href={`/vehicles/${vehicle.id}`}
                    className="block rounded-2xl border border-slate-200 p-4 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60"
                  >
                    <p className="font-bold text-slate-950 dark:text-white">
                      {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") ||
                        vehicle.unitNumber ||
                        "Vehicle"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {[vehicle.unitNumber ? `Unit ${vehicle.unitNumber}` : null, vehicle.licensePlate, vehicle.currentMileage != null ? `${vehicle.currentMileage} mi` : null]
                        .filter(Boolean)
                        .join(" | ") || "No vehicle details"}
                    </p>
                  </Link>
                ))
              )}
            </div>
            {canMutate ? (
              <Link
                href={`/vehicles?customerId=${customer.id}`}
                className="mt-5 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
              >
              Add vehicle
            </Link>
          ) : null}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
              Work Orders
            </h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Recent shop work for this customer.
            </p>
            <div className="mt-5 space-y-3">
              {customer.workOrders.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  No work orders yet.
                </p>
              ) : (
                customer.workOrders.map((workOrder) => (
                  <Link
                    key={workOrder.id}
                    href={`/work-orders/${workOrder.id}`}
                    className="block rounded-2xl border border-slate-200 p-4 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60"
                  >
                    <p className="font-bold text-slate-950 dark:text-white">
                      {workOrder.workOrderNumber}
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {[workOrder.title, workOrder.status.replaceAll("_", " "), workOrder.priority]
                        .filter(Boolean)
                        .join(" | ")}
                    </p>
                  </Link>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
