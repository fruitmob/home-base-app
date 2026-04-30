"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import clsx from "clsx";
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
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { formatCurrency } from "@/lib/core/money";
import { apiFetch } from "@/lib/api";
import { OpportunityStageString } from "@/components/sales/StageBadge";

const STAGES: OpportunityStageString[] = ["NEW", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"];

type KanbanOpportunity = {
  id: string;
  name: string;
  stage: OpportunityStageString;
  amount: number | string;
  customer?: { id: string; displayName: string };
};

type PipelineKanbanProps = {
  initialOpportunities: KanbanOpportunity[];
  canMutate: boolean;
};

export function PipelineKanban({ initialOpportunities, canMutate }: PipelineKanbanProps) {
  const [opportunities, setOpportunities] = useState<KanbanOpportunity[]>(initialOpportunities);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const opportunitiesByStage = useMemo(() => {
    const acc: Record<OpportunityStageString, KanbanOpportunity[]> = {
      NEW: [],
      QUALIFIED: [],
      PROPOSAL: [],
      NEGOTIATION: [],
      WON: [],
      LOST: [],
    };
    opportunities.forEach((opp) => {
      if (acc[opp.stage]) {
        acc[opp.stage].push(opp);
      }
    });
    return acc;
  }, [opportunities]);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    
    if (!over || !canMutate) return;

    const oppId = String(active.id);
    const draggedOpp = opportunities.find((o) => o.id === oppId);
    
    if (!draggedOpp) return;

    const currentStage = draggedOpp.stage;
    const newStage = String(over.id) as OpportunityStageString;

    // Terminal rule enforcement client-side visual
    if (currentStage === "WON" || currentStage === "LOST") {
      return; 
    }

    if (currentStage === newStage) {
      return;
    }

    // Optimistically update
    setOpportunities((prev) =>
      prev.map((o) => {
        if (o.id === oppId) {
          return { ...o, stage: newStage };
        }
        return o;
      })
    );

    // Call API
    const response = await apiFetch(`/api/opportunities/${oppId}/stage`, {
      method: "PATCH",
      body: JSON.stringify({ stage: newStage }),
    });

    if (!response.ok) {
      // Revert optimism
      setOpportunities((prev) =>
        prev.map((o) => {
          if (o.id === oppId) {
            return { ...o, stage: currentStage };
          }
          return o;
        })
      );
      alert("Failed to update opportunity stage. Returning to original position.");
    }
  }

  const activeOpp = useMemo(
    () => opportunities.find((o) => o.id === activeId),
    [activeId, opportunities]
  );

  return (
    <div className="flex h-[75vh] w-full gap-4 overflow-x-auto pb-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {STAGES.map((stage) => (
          <KanbanColumn
            key={stage}
            stage={stage}
            opportunities={opportunitiesByStage[stage]}
            canMutate={canMutate}
          />
        ))}

        <DragOverlay>
          {activeOpp ? (
            <KanbanCard opp={activeOpp} isOverlay={true} disabled={true} />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function KanbanColumn({
  stage,
  opportunities,
  canMutate,
}: {
  stage: OpportunityStageString;
  opportunities: KanbanOpportunity[];
  canMutate: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage,
  });

  const totalValue = opportunities.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        "flex min-w-[300px] max-w-[320px] flex-col rounded-3xl border bg-slate-50/50 p-4 transition-colors dark:bg-slate-900/50",
        isOver
          ? "border-blue-400 bg-blue-50/50 dark:border-blue-500/50 dark:bg-blue-900/20"
          : "border-slate-200 dark:border-slate-800"
      )}
    >
      <div className="mb-4 flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800/80">
        <h3 className="font-bold tracking-tight text-slate-800 dark:text-slate-200">
          {stage} <span className="text-xs font-medium text-slate-400">({opportunities.length})</span>
        </h3>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          {formatCurrency(totalValue)}
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
        {opportunities.map((opp) => {
          // Rule: Closed cards disable outgoing drag
          const isClosed = opp.stage === "WON" || opp.stage === "LOST";
          return (
            <KanbanCard
              key={opp.id}
              opp={opp}
              disabled={!canMutate || isClosed}
            />
          );
        })}
      </div>
    </div>
  );
}

function KanbanCard({
  opp,
  isOverlay = false,
  disabled = false,
}: {
  opp: KanbanOpportunity;
  isOverlay?: boolean;
  disabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: opp.id,
    disabled,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={clsx(
        "group flex flex-col rounded-2xl border bg-white p-4 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-950",
        isDragging && !isOverlay ? "opacity-30 border-dashed" : "border-slate-200 dark:border-slate-800",
        isOverlay ? "scale-105 shadow-xl rotate-1 ring-1 ring-blue-500 cursor-grabbing" : "",
        disabled ? "cursor-default" : "cursor-grab hover:border-slate-300 dark:hover:border-slate-700"
      )}
    >
      <div className="flex w-full flex-col">
        <div className="mb-2 flex items-start justify-between gap-2">
          <Link
            href={`/sales/opportunities/${opp.id}`}
            className="font-semibold leading-tight text-slate-900 transition-colors hover:text-blue-600 dark:text-white dark:hover:text-blue-400"
            // Stop propagation so clicking the link doesn't start drag erroneously if dragging starts there
            onPointerDown={(e) => e.stopPropagation()}
          >
            {opp.name}
          </Link>
          <span className="text-sm font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
            {formatCurrency(opp.amount)}
          </span>
        </div>
        
        {opp.customer && (
          <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">
            {opp.customer.displayName}
          </p>
        )}
      </div>
    </div>
  );
}
