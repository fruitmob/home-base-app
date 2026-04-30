"use client";

import type { WorkOrderStatus } from "@/generated/prisma/client";

const STATUS_CONFIG: Record<
  WorkOrderStatus,
  { label: string; baseClass: string }
> = {
  OPEN: {
    label: "Open",
    baseClass: "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-400/10 dark:text-blue-400 dark:ring-blue-400/30",
  },
  IN_PROGRESS: {
    label: "In Progress",
    baseClass: "bg-yellow-50 text-yellow-800 ring-yellow-600/20 dark:bg-yellow-400/10 dark:text-yellow-500 dark:ring-yellow-400/20",
  },
  ON_HOLD_PARTS: {
    label: "On Hold (Parts)",
    baseClass: "bg-orange-50 text-orange-800 ring-orange-600/20 dark:bg-orange-400/10 dark:text-orange-400 dark:ring-orange-400/20",
  },
  ON_HOLD_DELAY: {
    label: "On Hold (Delay)",
    baseClass: "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-400/10 dark:text-red-400 dark:ring-red-400/30",
  },
  QC: {
    label: "Quality Control",
    baseClass: "bg-indigo-50 text-indigo-700 ring-indigo-600/20 dark:bg-indigo-400/10 dark:text-indigo-400 dark:ring-indigo-400/30",
  },
  READY_TO_BILL: {
    label: "Ready to Bill",
    baseClass: "bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-500/10 dark:text-green-400 dark:ring-green-500/20",
  },
  CLOSED: {
    label: "Closed",
    baseClass: "bg-gray-50 text-gray-600 ring-gray-500/10 dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20",
  },
};

type StatusBadgeProps = {
  status: WorkOrderStatus;
  className?: string;
};

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || {
    label: status,
    baseClass: "bg-gray-50 text-gray-600 ring-gray-500/10 dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20",
  };

  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${config.baseClass} ${className}`}
    >
      {config.label}
    </span>
  );
}
