import { requirePageUser } from "@/lib/core/pageAuth";
import { db } from "@/lib/db";
import { format } from "date-fns";
import Link from "next/link";
import { CheckCircle2, Circle, Clock } from "lucide-react";

export const metadata = {
  title: "Training | Home Base",
};

export default async function TrainingPage() {
  const user = await requirePageUser();
  
  // Techs see their own assigned readings
  const myAssignments = await db.trainingAssignment.findMany({
    where: { assignedToId: user.id },
    include: {
      article: true,
      assignedBy: true,
      assignedTo: true,
      completion: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Managers see overview
  const isManager = user.role === "ADMIN" || user.role === "MANAGER";
  
  let teamAssignments: typeof myAssignments = [];
  if (isManager) {
    teamAssignments = await db.trainingAssignment.findMany({
      include: {
        article: true,
        assignedBy: true,
        assignedTo: true,
        completion: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Training</h1>
        <p className="text-slate-500 dark:text-slate-400">
          Standard operating procedures and compliance tracking.
        </p>
      </div>

      <div className="overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 bg-slate-50/50 px-8 py-6 dark:border-slate-800 dark:bg-slate-950/20">
          <div className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <Clock className="h-5 w-5 text-indigo-500" />
            My Action Items
          </div>
        </div>
        <div className="p-8">
          {myAssignments.length === 0 ? (
            <p className="text-sm font-medium text-slate-500">You are all caught up!</p>
          ) : (
            <div className="space-y-4">
              {myAssignments.map((assignment) => {
                const isComplete = !!assignment.completion;
                return (
                  <div key={assignment.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border p-5 bg-slate-50 dark:bg-slate-950/50 dark:border-slate-800 transition hover:border-slate-300 dark:hover:border-slate-700">
                    <div className="flex items-start sm:items-center gap-4">
                      {isComplete ? (
                        <CheckCircle2 className="mt-0.5 sm:mt-0 h-6 w-6 text-green-500 shrink-0" />
                      ) : (
                        <Circle className="mt-0.5 sm:mt-0 h-6 w-6 text-slate-300 dark:text-slate-700 shrink-0" />
                      )}
                      <div>
                        <Link href={`/kb/${assignment.article.slug}`} className="font-bold text-lg text-slate-900 dark:text-slate-100 hover:underline">
                          {assignment.article.title}
                        </Link>
                        <p className="text-sm font-medium text-slate-500 mt-1">
                          Assigned by {assignment.assignedBy.email} on {format(new Date(assignment.createdAt), "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>
                    {isComplete && (
                      <div className="text-sm font-bold tracking-wide uppercase text-green-600 dark:text-green-400 border border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-900/20 px-4 py-1.5 rounded-full whitespace-nowrap">
                        Completed
                      </div>
                    )}
                    {!isComplete && (
                      <Link href={`/kb/${assignment.article.slug}`} className="text-sm font-bold tracking-wide uppercase shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-full px-4 py-2 whitespace-nowrap">
                        Read & Complete &rarr;
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {isManager && (
        <div className="overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 bg-slate-50/50 px-8 py-6 dark:border-slate-800 dark:bg-slate-950/20">
            <h2 className="text-lg font-bold tracking-tight">Team Compliance</h2>
          </div>
          <div className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                    <th className="px-8 py-4 font-bold uppercase tracking-wider text-xs text-slate-500 dark:text-slate-400">Staff Member</th>
                    <th className="px-8 py-4 font-bold uppercase tracking-wider text-xs text-slate-500 dark:text-slate-400">Article</th>
                    <th className="px-8 py-4 font-bold uppercase tracking-wider text-xs text-slate-500 dark:text-slate-400">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {teamAssignments.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-8 py-6 font-medium text-slate-500">No training assigned yet.</td>
                    </tr>
                  )}
                  {teamAssignments.map((ta) => {
                    const isComplete = !!ta.completion;
                    return (
                      <tr key={ta.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition">
                        <td className="px-8 py-4 text-slate-900 dark:text-white font-semibold">{ta.assignedTo.email}</td>
                        <td className="px-8 py-4 text-slate-700 dark:text-slate-300 font-medium">{ta.article.title}</td>
                        <td className="px-8 py-4">
                          {isComplete ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-green-600 dark:text-green-400">
                              <CheckCircle2 className="h-4 w-4" /> Complete
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                              <Circle className="h-4 w-4" /> Pending
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
