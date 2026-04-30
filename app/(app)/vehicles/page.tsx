import Link from "next/link";
import { Prisma } from "@/generated/prisma/client";
import { VehicleForm } from "@/components/core/VehicleForm";
import { canWriteCustomerEntities } from "@/lib/core/permissions";
import { requirePageUser } from "@/lib/core/pageAuth";
import { db } from "@/lib/db";

type VehiclesPageProps = {
  searchParams?: {
    q?: string;
    customerId?: string;
  };
};

export default async function VehiclesPage({ searchParams }: VehiclesPageProps) {
  const user = await requirePageUser();
  const canMutate = canWriteCustomerEntities(user.role);
  const query = searchParams?.q?.trim() ?? "";
  const customerId = searchParams?.customerId?.trim() ?? "";
  const customers = await db.customer.findMany({
    where: { deletedAt: null },
    select: { id: true, displayName: true },
    orderBy: [{ displayName: "asc" }],
    take: 250,
  });
  const vehicles = await db.vehicle.findMany({
    where: {
      deletedAt: null,
      customer: { deletedAt: null },
      ...(customerId ? { customerId } : {}),
      ...(query
        ? {
          OR: [
            { vin: { contains: query, mode: Prisma.QueryMode.insensitive } },
            { normalizedVin: { contains: query, mode: Prisma.QueryMode.insensitive } },
            { make: { contains: query, mode: Prisma.QueryMode.insensitive } },
            { model: { contains: query, mode: Prisma.QueryMode.insensitive } },
            { unitNumber: { contains: query, mode: Prisma.QueryMode.insensitive } },
            { licensePlate: { contains: query, mode: Prisma.QueryMode.insensitive } },
            { customer: { displayName: { contains: query, mode: Prisma.QueryMode.insensitive } } },
          ],
        }
        : {}),
    },
    include: {
      customer: { select: { id: true, displayName: true } },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 100,
  });

  return (
    <section className="mx-auto max-w-7xl space-y-8">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="bg-[radial-gradient(circle_at_top_left,_#fecdd3,_transparent_28%),linear-gradient(135deg,_#f8fafc_0%,_#e2e8f0_100%)] px-8 py-10 dark:bg-[radial-gradient(circle_at_top_left,_rgba(190,18,60,0.42),_transparent_28%),linear-gradient(135deg,_#020617_0%,_#0f172a_100%)]">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">
            Fleet Register
          </p>
          <h2 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">
            Every unit gets one clean, searchable home.
          </h2>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
            Track the vehicle facts that future work orders, inspections, portal views, and mileage
            reporting will depend on.
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
        <div className="space-y-4">
          <form className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-[1fr_260px]">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Search Vehicles
              </span>
              <input
                name="q"
                defaultValue={query}
                placeholder="VIN, unit, plate, make, model"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-slate-800"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Customer
              </span>
              <select
                name="customerId"
                defaultValue={customerId}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-slate-800"
              >
                <option value="">All customers</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.displayName}
                  </option>
                ))}
              </select>
            </label>
          </form>

          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            {vehicles.length === 0 ? (
              <p className="p-8 text-slate-500 dark:text-slate-400">No vehicles found.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {vehicles.map((vehicle) => (
                  <Link
                    key={vehicle.id}
                    href={`/vehicles/${vehicle.id}`}
                    className="block p-5 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-lg font-black text-slate-950 dark:text-white">
                          {[vehicle.year, vehicle.make, vehicle.model, vehicle.trim]
                            .filter(Boolean)
                            .join(" ") || vehicle.unitNumber || "Vehicle"}
                        </p>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          {[vehicle.customer.displayName, vehicle.unitNumber ? `Unit ${vehicle.unitNumber}` : null, vehicle.licensePlate, vehicle.currentMileage != null ? `${vehicle.currentMileage} mi` : null]
                            .filter(Boolean)
                            .join(" | ") || "No vehicle details"}
                        </p>
                      </div>
                      <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">
                        {vehicle.normalizedVin ?? "No VIN"}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
            New Vehicle
          </h3>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Assign the unit to an active customer and capture VIN, plate, and mileage basics.
          </p>
          <div className="mt-6">
            <VehicleForm
              customers={customers}
              canMutate={canMutate}
              lockedCustomerId={customerId || undefined}
            />
          </div>
        </aside>
      </div>
    </section>
  );
}
