import Link from "next/link";
import { Prisma, WorkOrderPriority, WorkOrderStatus } from "@/generated/prisma/client";
import { canWriteWorkOrders } from "@/lib/core/permissions";
import { requirePageUser } from "@/lib/core/pageAuth";
import { formatCurrency } from "@/lib/core/money";
import { db } from "@/lib/db";

type WorkOrdersPageProps = {
  searchParams?: {
    q?: string;
    status?: string;
    priority?: string;
    assignedTechUserId?: string;
    customerId?: string;
    vehicleId?: string;
  };
};

export default async function WorkOrdersPage({ searchParams }: WorkOrdersPageProps) {
  const user = await requirePageUser();
  const canMutate = canWriteWorkOrders(user.role);
  const query = searchParams?.q?.trim() ?? "";
  const status = searchParams?.status?.trim().toUpperCase() ?? "";
  const priority = searchParams?.priority?.trim().toUpperCase() ?? "";
  const assignedTechUserId = searchParams?.assignedTechUserId?.trim() ?? "";
  const customerId = searchParams?.customerId?.trim() ?? "";
  const vehicleId = searchParams?.vehicleId?.trim() ?? "";
  const where: Prisma.WorkOrderWhereInput = { deletedAt: null };

  if (status) {
    if (Object.values(WorkOrderStatus).includes(status as WorkOrderStatus)) {
      where.status = status as WorkOrderStatus;
    }
  }

  if (priority) {
    if (Object.values(WorkOrderPriority).includes(priority as WorkOrderPriority)) {
      where.priority = priority as WorkOrderPriority;
    }
  }

  if (assignedTechUserId) {
    where.assignedTechUserId = assignedTechUserId === "unassigned" ? null : assignedTechUserId;
  }

  if (customerId) {
    where.customerId = customerId;
  }

  if (vehicleId) {
    where.vehicleId = vehicleId;
  }

  if (query) {
    where.OR = [
      { workOrderNumber: { contains: query, mode: Prisma.QueryMode.insensitive } },
      { title: { contains: query, mode: Prisma.QueryMode.insensitive } },
      { complaint: { contains: query, mode: Prisma.QueryMode.insensitive } },
      { customer: { displayName: { contains: query, mode: Prisma.QueryMode.insensitive } } },
      { vehicle: { unitNumber: { contains: query, mode: Prisma.QueryMode.insensitive } } },
      { vehicle: { normalizedVin: { contains: query.toUpperCase(), mode: Prisma.QueryMode.insensitive } } },
    ];
  }

  const workOrders = await db.workOrder.findMany({
    where,
    orderBy: [{ status: "asc" }, { promisedAt: "asc" }, { createdAt: "desc" }],
    include: {
      customer: { select: { id: true, displayName: true } },
      vehicle: {
        select: {
          id: true,
          year: true,
          make: true,
          model: true,
          unitNumber: true,
        },
      },
      assignedTech: { select: { id: true, email: true } },
      lineItems: {
        where: { deletedAt: null },
        select: { lineTotal: true },
      },
    },
    take: 250,
  });

  const activeCount = workOrders.filter((workOrder) => workOrder.status !== "CLOSED").length;

  return (
    <section className="mx-auto max-w-7xl space-y-8">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">
          Shop Operations
        </p>
        <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-4xl font-black tracking-tight text-slate-950 dark:text-white">
              Work Orders
            </h2>
            <p className="mt-4 max-w-2xl text-slate-600 dark:text-slate-300">
              Keep the service floor moving from intake through billing.
            </p>
          </div>
          {canMutate ? (
            <Link
              href="/work-orders/new"
              className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
            >
              New Work Order
            </Link>
          ) : null}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <span className="rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white dark:bg-white dark:text-slate-950">
            {activeCount} active
          </span>
          <span className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200">
            {workOrders.length} shown
          </span>
        </div>
      </div>

      <form className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-[1fr_180px_180px_auto]">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search work orders, customers, VINs..."
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-slate-800"
        />
        <select
          name="status"
          defaultValue={status}
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-slate-800"
        >
          <option value="">Any status</option>
          {["OPEN", "IN_PROGRESS", "ON_HOLD_PARTS", "ON_HOLD_DELAY", "QC", "READY_TO_BILL", "CLOSED"].map((value) => (
            <option key={value} value={value}>
              {value.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <select
          name="priority"
          defaultValue={priority}
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-slate-800"
        >
          <option value="">Any priority</option>
          {["LOW", "NORMAL", "HIGH", "URGENT"].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white dark:bg-white dark:text-slate-950"
        >
          Filter
        </button>
      </form>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {workOrders.length === 0 ? (
            <p className="px-6 py-10 text-center text-slate-500 dark:text-slate-400">
              No work orders match those filters.
            </p>
          ) : (
            workOrders.map((workOrder) => {
              const subtotal = workOrder.lineItems.reduce(
                (total, line) => total + Number(line.lineTotal),
                0,
              );
              const vehicleLabel = workOrder.vehicle
                ? [workOrder.vehicle.unitNumber ? `Unit ${workOrder.vehicle.unitNumber}` : null, workOrder.vehicle.year, workOrder.vehicle.make, workOrder.vehicle.model]
                    .filter(Boolean)
                    .join(" ")
                : null;

              return (
                <Link
                  key={workOrder.id}
                  href={`/work-orders/${workOrder.id}`}
                  className="grid gap-4 px-6 py-5 transition hover:bg-slate-50 dark:hover:bg-slate-800/60 md:grid-cols-[1.1fr_1fr_150px_130px]"
                >
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                      {workOrder.workOrderNumber}
                    </p>
                    <p className="mt-1 font-black text-slate-950 dark:text-white">
                      {workOrder.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {workOrder.customer.displayName}
                    </p>
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-300">
                    <p>{vehicleLabel ?? "No vehicle"}</p>
                    <p className="mt-1">{workOrder.assignedTech?.email ?? "Unassigned"}</p>
                  </div>
                  <div>
                    <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {workOrder.status.replaceAll("_", " ")}
                    </span>
                  </div>
                  <div className="font-black text-slate-950 dark:text-white">
                    {formatCurrency(subtotal)}
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
