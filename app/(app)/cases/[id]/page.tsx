import Link from "next/link";
import { ActivityTimeline } from "@/components/sales/ActivityTimeline";
import { CaseForm } from "@/components/sales/CaseForm";
import {
  CasePriorityBadge,
  CasePriorityString,
  CaseStatusBadge,
  CaseStatusString,
} from "@/components/sales/CaseStatusBadge";
import { CASE_WRITE_ROLES } from "@/lib/core/permissions";
import { requirePageUser } from "@/lib/core/pageAuth";
import { findActiveCase } from "@/lib/sales/cases";
import { db } from "@/lib/db";

export default async function CaseDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requirePageUser();
  const supportCase = await findActiveCase(params.id);
  const canMutate = (CASE_WRITE_ROLES as readonly string[]).includes(user.role);

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
    <section className="mx-auto max-w-7xl space-y-8">
      <Link
        href="/cases"
        className="inline-flex rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
      >
        &larr; Cases
      </Link>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-8">
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white">
                  {supportCase.subject}
                </h2>
                <p className="mt-1 font-medium text-slate-600 dark:text-slate-400">
                  {supportCase.customer.displayName}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <CasePriorityBadge priority={supportCase.priority as CasePriorityString} />
                <CaseStatusBadge status={supportCase.status as CaseStatusString} />
              </div>
            </div>

            <CaseForm
              canMutate={canMutate}
              initial={{
                id: supportCase.id,
                customerId: supportCase.customerId,
                vehicleId: supportCase.vehicleId,
                assignedUserId: supportCase.assignedUserId,
                status: supportCase.status as CaseStatusString,
                priority: supportCase.priority as CasePriorityString,
                subject: supportCase.subject,
                description: supportCase.description,
                resolutionNotes: supportCase.resolutionNotes,
              }}
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
        </div>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-4 text-lg font-black tracking-tight text-slate-950 dark:text-white">
              Activity History
            </h3>
            <ActivityTimeline parentKey="caseId" parentId={supportCase.id} canCompose={canMutate} />
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-950">
            <h3 className="mb-4 text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Details
            </h3>
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
                <dt className="text-slate-500 dark:text-slate-400">Opened By</dt>
                <dd className="font-semibold text-slate-900 dark:text-slate-200">
                  {supportCase.openedByUser?.email ?? "Unknown"}
                </dd>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
                <dt className="text-slate-500 dark:text-slate-400">Assigned To</dt>
                <dd className="font-semibold text-slate-900 dark:text-slate-200">
                  {supportCase.assignedUser?.email ?? "Unassigned"}
                </dd>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
                <dt className="text-slate-500 dark:text-slate-400">Vehicle</dt>
                <dd className="font-semibold text-slate-900 dark:text-slate-200">
                  {supportCase.vehicle
                    ? [supportCase.vehicle.unitNumber, supportCase.vehicle.year, supportCase.vehicle.make, supportCase.vehicle.model]
                        .filter(Boolean)
                        .join(" ")
                    : "None"}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500 dark:text-slate-400">Resolved</dt>
                <dd className="font-semibold text-slate-900 dark:text-slate-200">
                  {supportCase.resolvedAt ? new Date(supportCase.resolvedAt).toLocaleDateString() : "--"}
                </dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </section>
  );
}
