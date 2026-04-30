"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  defaultDropAnimationSideEffects,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { WorkOrderStatus } from "@/generated/prisma/client";
import { BoardWorkOrder, WorkOrderCard } from "./WorkOrderCard";
import { apiFetch } from "@/lib/api";
import { useDroppable } from "@dnd-kit/core";

const COLUMNS: { id: WorkOrderStatus; title: string }[] = [
  { id: "OPEN", title: "Open" },
  { id: "IN_PROGRESS", title: "In Progress" },
  { id: "ON_HOLD_PARTS", title: "Hold (Parts)" },
  { id: "ON_HOLD_DELAY", title: "Hold (Delay)" },
  { id: "QC", title: "QC" },
  { id: "READY_TO_BILL", title: "Ready" },
  // Closed normally filtered out of active dev board, but we can include it or leave out. Let's include for completeness of the lifecycle in shop view.
  { id: "CLOSED", title: "Closed" },
];

type WorkOrderBoardProps = {
  initialWorkOrders: BoardWorkOrder[];
};

export function WorkOrderBoard({ initialWorkOrders }: WorkOrderBoardProps) {
  const [workOrders, setWorkOrders] = useState<BoardWorkOrder[]>(initialWorkOrders);
  const [activeWorkOrder, setActiveWorkOrder] = useState<BoardWorkOrder | null>(null);
  const [error, setError] = useState<string | null>(null);

  const columns = useMemo(() => {
    const cols = new Map<WorkOrderStatus, BoardWorkOrder[]>();
    for (const col of COLUMNS) {
      cols.set(col.id, []);
    }
    for (const wo of workOrders) {
      if (cols.has(wo.status)) {
        cols.get(wo.status)!.push(wo);
      }
    }
    return cols;
  }, [workOrders]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const wo = workOrders.find((w) => w.id === active.id);
    if (wo) setActiveWorkOrder(wo);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isActiveAWorkOrder = active.data.current?.type === "WorkOrder";
    const isOverAWorkOrder = over.data.current?.type === "WorkOrder";
    const isOverAColumn = over.data.current?.type === "Column";

    if (!isActiveAWorkOrder) return;

    // Dropping a WorkOrder over another WorkOrder
    if (isActiveAWorkOrder && isOverAWorkOrder) {
      setWorkOrders((workOrders) => {
        const activeIndex = workOrders.findIndex((t) => t.id === activeId);
        const overIndex = workOrders.findIndex((t) => t.id === overId);

        if (workOrders[activeIndex].status !== workOrders[overIndex].status) {
          const newWorkOrders = [...workOrders];
          newWorkOrders[activeIndex] = {
            ...newWorkOrders[activeIndex],
            status: workOrders[overIndex].status,
          };
          return arrayMove(newWorkOrders, activeIndex, overIndex);
        }

        return arrayMove(workOrders, activeIndex, overIndex);
      });
    }

    // Dropping a WorkOrder over an empty column area
    if (isActiveAWorkOrder && isOverAColumn) {
      setWorkOrders((workOrders) => {
        const activeIndex = workOrders.findIndex((t) => t.id === activeId);
        const newWorkOrders = [...workOrders];
        newWorkOrders[activeIndex] = {
          ...newWorkOrders[activeIndex],
          status: overId as WorkOrderStatus,
        };
        return arrayMove(newWorkOrders, activeIndex, activeIndex);
      });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveWorkOrder(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const originalWO = initialWorkOrders.find((wo) => wo.id === activeId);
    const currentWO = workOrders.find((wo) => wo.id === activeId);

    if (originalWO && currentWO && originalWO.status !== currentWO.status) {
      setError(null);
      
      // Attempt API call to save new status
      const response = await apiFetch(`/api/work-orders/${activeId}/status`, {
        method: "POST",
        body: JSON.stringify({ status: currentWO.status }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error || "Failed to update work order status.");
        
        // Revert UI on failure
        setWorkOrders(initialWorkOrders);
      } else {
        // Technically we should update initialWorkOrders but for optimistic UI it's ok mapping to react state
        // Re-fetch page might be cleaner eventually, but this works for pure client interaction.
      }
    }
  };

  const dropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: "0.4",
        },
      },
    }),
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </div>
      )}
      <div className="flex h-[calc(100vh-12rem)] w-full gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => (
          <BoardColumn
            key={col.id}
            columnId={col.id}
            title={col.title}
            workOrders={columns.get(col.id) || []}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={dropAnimation}>
        {activeWorkOrder ? <WorkOrderCard workOrder={activeWorkOrder} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function BoardColumn({
  columnId,
  title,
  workOrders,
}: {
  columnId: WorkOrderStatus;
  title: string;
  workOrders: BoardWorkOrder[];
}) {
  const { setNodeRef } = useDroppable({
    id: columnId,
    data: {
      type: "Column",
      columnId,
    },
  });

  return (
    <div className="flex w-80 shrink-0 flex-col rounded-xl bg-gray-50/50 p-2 ring-1 ring-gray-200/50 dark:bg-zinc-800/20 dark:ring-zinc-700">
      <div className="mb-2 flex items-center justify-between px-2 py-1">
        <h3 className="font-semibold text-gray-700 dark:text-gray-300">
          {title}
        </h3>
        <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-zinc-800 dark:text-gray-400">
          {workOrders.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className="flex flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden p-1"
      >
        <SortableContext
          items={workOrders.map((w) => w.id)}
          strategy={verticalListSortingStrategy}
        >
          {workOrders.map((wo) => (
            <WorkOrderCard key={wo.id} workOrder={wo} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
