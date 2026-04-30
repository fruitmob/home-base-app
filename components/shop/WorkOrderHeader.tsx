import Link from "next/link";
import { formatCurrency } from "@/lib/core/money";

type WorkOrderHeaderProps = {
  workOrderNumber: string;
  title: string;
  status: string;
  priority: string;
  customer: { id: string; displayName: string };
  vehicle?: {
    id: string;
    year: number | null;
    make: string | null;
    model: string | null;
    unitNumber: string | null;
  } | null;
  subtotal: number;
};

export function WorkOrderHeader({
  workOrderNumber,
  title,
  status,
  priority,
  customer,
  vehicle,
  subtotal,
}: WorkOrderHeaderProps) {
  const vehicleLabel = vehicle
    ? [vehicle.unitNumber ? `Unit ${vehicle.unitNumber}` : null, vehicle.year, vehicle.make, vehicle.model]
        .filter(Boolean)
        .join(" ")
    : null;

  return (
    <div className="flex flex-col gap-5 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <Link
          href="/work-orders"
          className="text-sm font-bold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          Back to work orders
        </Link>
        <p className="mt-4 text-sm font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
          {workOrderNumber}
        </p>
        <h2 className="mt-2 text-4xl font-black tracking-tight text-slate-950 dark:text-white">
          {title}
        </h2>
        <p className="mt-3 text-slate-500 dark:text-slate-400">
          <Link href={`/customers/${customer.id}`} className="font-bold hover:underline">
            {customer.displayName}
          </Link>
          {vehicle && vehicleLabel ? (
            <>
              {" | "}
              <Link href={`/vehicles/${vehicle.id}`} className="font-bold hover:underline">
                {vehicleLabel}
              </Link>
            </>
          ) : null}
        </p>
      </div>

      <div className="flex flex-wrap gap-3 lg:justify-end">
        <span className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white dark:bg-white dark:text-slate-950">
          {status.replaceAll("_", " ")}
        </span>
        <span className="rounded-full border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 dark:border-slate-700 dark:text-slate-200">
          {priority}
        </span>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          {formatCurrency(subtotal)}
        </span>
      </div>
    </div>
  );
}
