export type CaseStatusString = "OPEN" | "WAITING" | "RESOLVED" | "CANCELED";
export type CasePriorityString = "LOW" | "NORMAL" | "HIGH" | "URGENT";

const statusClasses: Record<CaseStatusString, string> = {
  OPEN: "bg-blue-50 text-blue-700 ring-blue-700/10 dark:bg-blue-400/10 dark:text-blue-300 dark:ring-blue-400/20",
  WAITING: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/20",
  RESOLVED: "bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-500/10 dark:text-green-300 dark:ring-green-500/20",
  CANCELED: "bg-slate-100 text-slate-700 ring-slate-600/20 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-500/20",
};

const priorityClasses: Record<CasePriorityString, string> = {
  LOW: "bg-slate-100 text-slate-700 ring-slate-600/20 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-500/20",
  NORMAL: "bg-blue-50 text-blue-700 ring-blue-700/10 dark:bg-blue-400/10 dark:text-blue-300 dark:ring-blue-400/20",
  HIGH: "bg-orange-50 text-orange-700 ring-orange-600/20 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-500/20",
  URGENT: "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/20",
};

export function CaseStatusBadge({ status }: { status: CaseStatusString }) {
  return <Badge label={status} className={statusClasses[status]} />;
}

export function CasePriorityBadge({ priority }: { priority: CasePriorityString }) {
  return <Badge label={priority} className={priorityClasses[priority]} />;
}

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${className}`}>
      {label}
    </span>
  );
}
