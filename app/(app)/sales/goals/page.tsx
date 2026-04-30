import { Prisma, Role } from "@/generated/prisma/client";
import { SalesGoalForm } from "@/components/sales/SalesGoalForm";
import { formatCurrency } from "@/lib/core/money";
import { SALES_GOAL_WRITE_ROLES } from "@/lib/core/permissions";
import { requirePageUser } from "@/lib/core/pageAuth";
import { attainment } from "@/lib/sales/goals";
import { db } from "@/lib/db";

type SalesGoalsPageProps = {
  searchParams?: {
    period?: string;
    userId?: string;
  };
};

export default async function SalesGoalsPage({ searchParams }: SalesGoalsPageProps) {
  const user = await requirePageUser();
  const canMutate = (SALES_GOAL_WRITE_ROLES as readonly string[]).includes(user.role);
  const periodParam = searchParams?.period?.trim() ?? "";
  const userIdParam = searchParams?.userId?.trim() ?? "";

  const users = await db.user.findMany({
    where: {
      deletedAt: null,
      role: { in: [Role.SALES_REP, Role.SALES_MANAGER, Role.MANAGER, Role.ADMIN, Role.OWNER] },
    },
    select: { id: true, email: true, role: true },
    orderBy: { email: "asc" },
  });

  const whereAnd: Prisma.SalesGoalWhereInput[] = [{ deletedAt: null }];

  if (periodParam) {
    whereAnd.push({ period: periodParam });
  }

  if (user.role === Role.SALES_REP) {
    whereAnd.push({ userId: user.id });
  } else if (userIdParam) {
    whereAnd.push({ userId: userIdParam });
  }

  const goals = await db.salesGoal.findMany({
    where: { AND: whereAnd },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: [{ period: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  const rows = await Promise.all(
    goals.map(async (goal) => {
      const attainmentAmount = await attainment(goal.userId, goal.period);
      const targetAmount = Number(goal.targetAmount);

      return {
        id: goal.id,
        userEmail: goal.user.email,
        period: goal.period,
        targetAmount,
        notes: goal.notes,
        attainmentAmount,
        attainmentPercent: targetAmount > 0 ? Math.round((attainmentAmount / targetAmount) * 100) : 0,
      };
    }),
  );

  return (
    <section className="mx-auto max-w-7xl space-y-8">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="bg-[linear-gradient(135deg,_#f8fafc_0%,_#dcfce7_100%)] px-8 py-10 dark:bg-[linear-gradient(135deg,_#020617_0%,_#052e16_100%)]">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">
            Sales Goals
          </p>
          <h2 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">
            Monthly Targets
          </h2>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
            Set revenue goals and compare them against won opportunity totals.
          </p>
        </div>
      </div>

      {canMutate ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-5 text-xl font-black tracking-tight text-slate-950 dark:text-white">
            Create Goal
          </h3>
          <SalesGoalForm
            canMutate={canMutate}
            users={users.map((goalUser) => ({
              id: goalUser.id,
              label: `${goalUser.email} (${goalUser.role})`,
            }))}
          />
        </div>
      ) : null}

      <form className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-3">
        <label>
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Period
          </span>
          <input
            name="period"
            type="month"
            defaultValue={periodParam}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </label>

        {user.role !== Role.SALES_REP ? (
          <label>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              User
            </span>
            <select
              name="userId"
              defaultValue={userIdParam}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            >
              <option value="">Everyone</option>
              {users.map((goalUser) => (
                <option key={goalUser.id} value={goalUser.id}>
                  {goalUser.email}
                </option>
              ))}
            </select>
          </label>
        ) : null}

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
              <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">User</th>
              <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Period</th>
              <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Target</th>
              <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Won</th>
              <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Attainment</th>
              <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="px-5 py-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {row.userEmail}
                </td>
                <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">
                  {row.period}
                </td>
                <td className="px-5 py-4 text-right text-sm text-slate-600 dark:text-slate-300">
                  {formatCurrency(row.targetAmount)}
                </td>
                <td className="px-5 py-4 text-right text-sm text-slate-600 dark:text-slate-300">
                  {formatCurrency(row.attainmentAmount)}
                </td>
                <td className="px-5 py-4 text-right text-sm font-bold text-slate-900 dark:text-slate-100">
                  {row.attainmentPercent}%
                </td>
                <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">
                  {row.notes ?? ""}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-500">
                  No sales goals match those filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
