"use client";

import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatDistanceToNow } from "date-fns";
import type { WorkOrderStatus } from "@/generated/prisma/client";
import { StatusBadge } from "./StatusBadge";

export type BoardWorkOrder = {
  id: string;
  workOrderNumber: string;
  title: string;
  status: WorkOrderStatus;
  priority: string;
  customer: { displayName: string };
  vehicle?: { make: string | null; model: string | null; year: number | null } | null;
  bay?: { name: string } | null;
  updatedAt: string | Date;
};

type WorkOrderCardProps = {
  workOrder: BoardWorkOrder;
};

export function WorkOrderCard({ workOrder }: WorkOrderCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: workOrder.id,
    data: {
      type: "WorkOrder",
      workOrder,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="rounded-lg border-2 border-dashed border-blue-500 bg-blue-50 p-4 opacity-50 dark:border-blue-400 dark:bg-blue-900/20"
      >
        <div className="h-20" />
      </div>
    );
  }

  const vehicleName = workOrder.vehicle
    ? `${workOrder.vehicle.year} ${workOrder.vehicle.make} ${workOrder.vehicle.model}`
    : "No vehicle assigned";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="group relative flex cursor-grab flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:border-blue-300 hover:shadow-md active:cursor-grabbing dark:border-gray-800 dark:bg-zinc-900 dark:hover:border-blue-500/50"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href={`/work-orders/${workOrder.id}`}
            className="font-medium text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {workOrder.workOrderNumber}
          </Link>
          <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {workOrder.title}
          </div>
        </div>
        {workOrder.priority === "URGENT" && (
          <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-500/20 dark:text-red-400">
            Urgent
          </span>
        )}
      </div>

      <div className="text-xs text-gray-500 dark:text-gray-400">
        <div className="truncate">{workOrder.customer.displayName}</div>
        <div className="truncate">{vehicleName}</div>
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-2">
          <StatusBadge status={workOrder.status} />
          {workOrder.bay && (
            <span className="rounded-md bg-zinc-100 px-2 py-1 dark:bg-zinc-800">
              {workOrder.bay.name}
            </span>
          )}
        </div>
        <div title={new Date(workOrder.updatedAt).toLocaleString()}>
          {formatDistanceToNow(new Date(workOrder.updatedAt), {
            addSuffix: true,
          })}
        </div>
      </div>
    </div>
  );
}
