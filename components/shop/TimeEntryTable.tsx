"use client";
import { format } from "date-fns";

type TimeEntryProps = {
  id: string;
  status: string;
  active: boolean;
  startedAt: string | null;
  endedAt: string | null;
  durationMinutes: number;
  billableMinutes: number;
  pauseReason: string | null;
  user: { email: string } | null;
  workOrder: { workOrderNumber: string } | null;
  note: string | null;
};

interface TimeEntryTableProps {
  entries: TimeEntryProps[];
  isManagerView?: boolean;
  onApprove?: (id: string) => void;
  onReject?: (id: string, reason: string) => void;
  onSubmit?: (id: string) => void;
}

export function TimeEntryTable({ entries, isManagerView, onApprove, onReject, onSubmit }: TimeEntryTableProps) {
  function formatMinutes(mins: number) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  }

  function renderStatusBadge(status: string) {
    const base = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2";
    switch (status) {
      case "DRAFT":
        return <span className={`${base} bg-slate-100 text-slate-900 border border-transparent`}>Draft</span>;
      case "SUBMITTED":
        return <span className={`${base} bg-yellow-500 text-slate-50 border border-transparent`}>Pending Approval</span>;
      case "APPROVED":
        return <span className={`${base} bg-green-500 text-slate-50 border border-transparent`}>Approved</span>;
      case "REJECTED":
        return <span className={`${base} bg-red-500 text-slate-50 border border-transparent`}>Rejected</span>;
      case "LOCKED":
        return <span className={`${base} border border-slate-200 text-slate-950`}>Locked</span>;
      default:
        return <span className={base}>{status}</span>;
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-6 py-4">Work Order</th>
              {isManagerView && <th className="px-6 py-4">Tech</th>}
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Duration</th>
              <th className="px-6 py-4">Notes</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={isManagerView ? 7 : 6} className="px-6 py-8 text-center text-slate-500">
                  No time entries found.
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                    {entry.workOrder?.workOrderNumber || "—"}
                  </td>
                  {isManagerView && (
                    <td className="px-6 py-4">
                      {entry.user ? entry.user.email : "?"}
                    </td>
                  )}
                  <td className="px-6 py-4">
                    {entry.startedAt ? format(new Date(entry.startedAt), "MMM d, yyyy") : "—"}
                  </td>
                  <td className="px-6 py-4">
                    {entry.active ? (
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 bg-blue-500 text-slate-50 animate-pulse border border-transparent">Active</span>
                    ) : (
                      renderStatusBadge(entry.status)
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {formatMinutes(entry.durationMinutes)}
                  </td>
                  <td className="px-6 py-4 max-w-xs truncate" title={entry.note || ""}>
                    {entry.note || "—"}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    {!isManagerView && (entry.status === "DRAFT" || entry.status === "REJECTED") && !entry.active && onSubmit && (
                      <button type="button" className="inline-flex h-9 items-center justify-center rounded-md bg-slate-900 px-3 text-sm font-medium text-slate-50 transition-colors hover:bg-slate-900/90 dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-slate-50/90" onClick={() => onSubmit(entry.id)}>
                        Submit
                      </button>
                    )}
                    {isManagerView && entry.status === "SUBMITTED" && onApprove && onReject && (
                      <div className="flex justify-end gap-2">
                        <button type="button" className="inline-flex h-9 items-center justify-center rounded-md border border-green-500 bg-transparent px-3 text-sm font-medium text-green-600 shadow-sm transition-colors hover:bg-green-50 dark:hover:bg-green-950" onClick={() => onApprove(entry.id)}>
                          Approve
                        </button>
                        <button type="button" className="inline-flex h-9 items-center justify-center rounded-md border border-red-500 bg-transparent px-3 text-sm font-medium text-red-600 shadow-sm transition-colors hover:bg-red-50 dark:hover:bg-red-950" onClick={() => {
                          const reason = prompt("Enter rejection reason:");
                          if (reason) onReject(entry.id, reason);
                        }}>
                          Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
