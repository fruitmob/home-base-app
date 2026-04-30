import Link from "next/link";
import { notFound } from "next/navigation";
import { ArchiveButton } from "@/components/core/ArchiveButton";
import { VehicleForm } from "@/components/core/VehicleForm";
import { ActivityTimeline } from "@/components/sales/ActivityTimeline";
import { canWriteCustomerEntities } from "@/lib/core/permissions";
import { requirePageUser } from "@/lib/core/pageAuth";
import { db } from "@/lib/db";

type VehicleDetailPageProps = {
  params: {
    id: string;
  };
};

export default async function VehicleDetailPage({ params }: VehicleDetailPageProps) {
  const user = await requirePageUser();
  const canMutate = canWriteCustomerEntities(user.role);
  const [vehicle, customers] = await Promise.all([
    db.vehicle.findFirst({
      where: {
        id: params.id,
        deletedAt: null,
        customer: { deletedAt: null },
      },
      include: {
        customer: { select: { id: true, displayName: true } },
        vehicleNotes: {
          orderBy: [{ createdAt: "desc" }],
          take: 20,
        },
        mileageReadings: {
          orderBy: [{ recordedAt: "desc" }, { createdAt: "desc" }],
          take: 20,
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
    }),
    db.customer.findMany({
      where: { deletedAt: null },
      select: { id: true, displayName: true },
      orderBy: [{ displayName: "asc" }],
      take: 250,
    }),
  ]);

  if (!vehicle) {
    notFound();
  }

  const vehicleTitle =
    [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ") ||
    vehicle.unitNumber ||
    "Vehicle";

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link href="/vehicles" className="text-sm font-bold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
            Back to vehicles
          </Link>
          <h2 className="mt-3 text-4xl font-black tracking-tight text-slate-950 dark:text-white">
            {vehicleTitle}
          </h2>
          <p className="mt-3 text-slate-500 dark:text-slate-400">
            {[vehicle.customer.displayName, vehicle.unitNumber ? `Unit ${vehicle.unitNumber}` : null, vehicle.normalizedVin, vehicle.currentMileage != null ? `${vehicle.currentMileage} mi` : null]
              .filter(Boolean)
              .join(" | ") || "No vehicle details"}
          </p>
        </div>
        <ArchiveButton
          endpoint={`/api/vehicles/${vehicle.id}`}
          label="vehicle"
          redirectTo="/vehicles"
          canMutate={canMutate}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-5 text-xl font-black tracking-tight text-slate-950 dark:text-white">
              Vehicle Record
            </h3>
            <VehicleForm initial={vehicle} customers={customers} canMutate={canMutate} />
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-5 text-xl font-black tracking-tight text-slate-950 dark:text-white">
              Activity History
            </h3>
            <ActivityTimeline parentKey="vehicleId" parentId={vehicle.id} />
          </article>
        </div>

        <aside className="space-y-4">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
              Mileage History
            </h3>
            <div className="mt-5 space-y-3">
              {vehicle.mileageReadings.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  No mileage readings yet. Updating current mileage will add one.
                </p>
              ) : (
                vehicle.mileageReadings.map((reading) => (
                  <div
                    key={reading.id}
                    className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"
                  >
                    <p className="font-black text-slate-950 dark:text-white">
                      {reading.value.toLocaleString()} mi
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {[reading.source, reading.note, reading.recordedAt.toLocaleDateString()]
                        .filter(Boolean)
                        .join(" | ")}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
              Work Orders
            </h3>
            <div className="mt-5 space-y-3">
              {vehicle.workOrders.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  No work orders yet.
                </p>
              ) : (
                vehicle.workOrders.map((workOrder) => (
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
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
              Vehicle Notes
            </h3>
            <div className="mt-5 space-y-3">
              {vehicle.vehicleNotes.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  No notes yet.
                </p>
              ) : (
                vehicle.vehicleNotes.map((note) => (
                  <div
                    key={note.id}
                    className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"
                  >
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                      {note.type.replaceAll("_", " ")}
                    </p>
                    <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{note.body}</p>
                  </div>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}
