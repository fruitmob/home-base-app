import { cookies } from "next/headers";
import { Role } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { IMPERSONATION_COOKIE_NAME } from "@/lib/authConstants";
import { getActiveImpersonation } from "@/lib/admin/impersonation";
import { requireOwnerPageUser } from "@/lib/core/pageAuth";
import { ImpersonationManager } from "@/components/admin/ImpersonationManager";

function formatTimestamp(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function AdminImpersonationPage() {
  const actor = await requireOwnerPageUser();

  const impersonationId = cookies().get(IMPERSONATION_COOKIE_NAME)?.value;
  const activeImpersonation = await getActiveImpersonation(impersonationId, actor.id);

  const [impersonatableUsers, recentHistory] = await Promise.all([
    db.user.findMany({
      where: { role: { not: Role.OWNER }, deletedAt: null },
      select: { id: true, email: true, role: true },
      orderBy: { email: "asc" },
    }),
    db.impersonation.findMany({
      orderBy: { startedAt: "desc" },
      take: 15,
      include: {
        actorUser: { select: { email: true } },
        targetUser: { select: { email: true, role: true } },
      },
    }),
  ]);

  const serializedActive = activeImpersonation
    ? {
        id: activeImpersonation.id,
        targetEmail: activeImpersonation.targetEmail,
        targetRole: activeImpersonation.targetRole,
        reason: activeImpersonation.reason,
      }
    : null;

  return (
    <section className="mx-auto max-w-4xl space-y-8">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="bg-[radial-gradient(circle_at_top_right,_#fde68a,_transparent_30%),linear-gradient(135deg,_#fffbeb_0%,_#e2e8f0_100%)] px-8 py-10 dark:bg-[radial-gradient(circle_at_top_right,_rgba(251,191,36,0.3),_transparent_30%),linear-gradient(135deg,_#111827_0%,_#020617_100%)]">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">
            Admin Tools
          </p>
          <h2 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">
            Support Impersonation
          </h2>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
            View the platform exactly as a specific user sees it. Every session is logged and visible
            in the audit trail.
          </p>
        </div>
      </div>

      <ImpersonationManager
        impersonatableUsers={impersonatableUsers.map((u) => ({
          id: u.id,
          email: u.email,
          role: u.role as string,
        }))}
        activeImpersonation={serializedActive}
      />

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
          <h3 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
            Recent sessions
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            The last 15 impersonation sessions, active and ended.
          </p>
        </div>
        {recentHistory.length === 0 ? (
          <p className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400">
            No impersonation sessions have been recorded yet.
          </p>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {recentHistory.map((session) => (
              <div key={session.id} className="px-6 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950 dark:text-white">
                      {session.targetUser.email}{" "}
                      <span className="font-normal text-slate-500 dark:text-slate-400">
                        ({session.targetUser.role.replaceAll("_", " ")})
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Actor: {session.actorUser.email} &middot; Reason: {session.reason}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                      Started: {formatTimestamp(session.startedAt)}
                      {session.endedAt
                        ? ` · Ended: ${formatTimestamp(session.endedAt)}`
                        : ""}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-[0.16em] ${
                      session.endedAt === null
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    {session.endedAt === null ? "Active" : "Ended"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
