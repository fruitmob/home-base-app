import clsx from "clsx";
import { LeadStatus } from "@/generated/prisma/client";

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset",
        {
          "bg-blue-50 text-blue-700 ring-blue-700/10 dark:bg-blue-400/10 dark:text-blue-400 dark:ring-blue-400/20":
            status === "NEW",
          "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-400/10 dark:text-amber-400 dark:ring-amber-400/20":
            status === "WORKING",
          "bg-indigo-50 text-indigo-700 ring-indigo-700/10 dark:bg-indigo-400/10 dark:text-indigo-400 dark:ring-indigo-400/20":
            status === "QUALIFIED",
          "bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-500/10 dark:text-green-400 dark:ring-green-500/20":
            status === "CONVERTED",
          "bg-slate-50 text-slate-600 ring-slate-500/10 dark:bg-slate-400/10 dark:text-slate-400 dark:ring-slate-400/20":
            status === "UNQUALIFIED",
        },
      )}
    >
      {status}
    </span>
  );
}
