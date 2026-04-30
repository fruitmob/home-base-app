import Link from "next/link";
import { CasePriority, CaseStatus, Prisma } from "@/generated/prisma/client";
import {
  CasePriorityBadge,
  CasePriorityString,
  CaseStatusBadge,
  CaseStatusString,
} from "@/components/sales/CaseStatusBadge";
import { requirePageUser } from "@/lib/core/pageAuth";
import { CASE_WRITE_ROLES } from "@/lib/core/permissions";
import { db } from "@/lib/db";

type CasesPageProps = {
  searchParams?: {
    status?: string;
    priority?: string;
    assignedUserId?: string;
  };
};

const statuses = ["OPEN", "WAITING", "RESOLVED", "CANCELED"] as const;
const priorities = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;

export default async function CasesPage({ searchParams }: CasesPageProps) {
  const user = await requirePageUser();
  const canMutate = (CASE_WRITE_ROLES as readonly string[]).includes(user.role);

  const statusParam = searchParams?.status?.trim() ?? "";
  const priorityParam = searchParams?.priority?.trim() ?? "";
  const assignedUserIdParam = searchParams?.assignedUserId?.trim() ?? "";

  const where: Prisma.CaseWhereInput = {
    deletedAt: null,
  };

  if (statuses.includes(statusParam as CaseStatusString)) {
    where.status = statusParam as CaseStatus;
  }

  if (priorities.includes(priorityParam as CasePriorityString)) {
    where.priority = priorityParam as CasePriority;
  }

  if (assignedUserIdParam === "unassigned") {
    where.assignedUserId = null;
  } else if (assignedUserIdParam) {
    where.assignedUserId = assignedUserIdParam;
  }

  const [cases, users] = await Promise.all([
    db.case.findMany({
      where,
      include: {
        customer: { select: { id: true, displayName: true } },
        vehicle: { select: { id: true, year: true, make: true, model: true, unitNumber: true } },
        assignedUser: { select: { id: true, email: true } },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 200,
    }),
    db.user.findMany({
      where: { deletedAt: null },
      select: { id: true, email: true },
      orderBy: { email: "asc" },
    }),
  ]);

  const openCount = cases.filter((supportCase) => supportCase.status === "OPEN" || supportCase.status === "WAITING").length;

  return (
    <section className="mx-auto max-w-7xl space-y-8">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="bg-[linear-gradient(135deg,_#f8fafc_0%,_#e0f2fe_100%)] px-8 py-10 dark:bg-[linear-gradient(135deg,_#020617_0%,_#082f49_100%)]">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">
            Customer Care
          </p>
          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="max-w-3xl text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">
                Cases
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
                Track callbacks, questions, and customer concerns after the sale.
              </p>
            </div>
            {canMutate ? (
              <Link
                href="/cases/new"
                className="inline-flex items-center justify-center rounded-full bg-blue-600 px-6 py-3 font-bold text-white transition hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                New Case
              </Link>
            ) : null}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <span className="rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white dark:bg-white dark:text-slate-950">
              {openCount} active
            </span>
          </div>
        </div>
      </div>

      <form className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-4">
        <label>
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Status
          </span>
          <select
            name="status"
            defaultValue={statusParam}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          >
            <option value="">Any status</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Priority
          </span>
          <select
            name="priority"
            defaultValue={priorityParam}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          >
            <option value="">Any priority</option>
            {priorities.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Assigned
          </span>
          <select
            name="assignedUserId"
            defaultValue={assignedUserIdParam}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          >
            <option value="">Anyone</option>
            <option value="unassigned">Unassigned</option>
            {users.map((assignee) => (
              <option key={assignee.id} value={assignee.id}>
                {assignee.email}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-end">
          <button
            type="submit"
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Apply filters
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
          <thead className="bg-slate-50 dark:bg-slate-950">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Subject</th>
              <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Customer</th>
              <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Assigned</th>
              <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Priority</th>
              <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {cases.map((supportCase) => (
              <tr key={supportCase.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="px-5 py-4 text-sm font-semibold">
                  <Link href={`/cases/${supportCase.id}`} className="text-blue-600 hover:underline dark:text-blue-400">
                    {supportCase.subject}
                  </Link>
                </td>
                <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">
                  {supportCase.customer.displayName}
                </td>
                <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">
                  {supportCase.assignedUser?.email ?? "Unassigned"}
                </td>
                <td className="px-5 py-4 text-sm">
                  <CasePriorityBadge priority={supportCase.priority as CasePriorityString} />
                </td>
                <td className="px-5 py-4 text-sm">
                  <CaseStatusBadge status={supportCase.status as CaseStatusString} />
                </td>
              </tr>
            ))}
            {cases.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-500">
                  No cases match those filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
