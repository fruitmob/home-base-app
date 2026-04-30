"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { apiFetch } from "@/lib/api";
import type { ReportOverviewCard } from "@/lib/reports/dashboard";
import type { DashboardLayoutRecord, WidgetId } from "@/lib/reports/layout";

type ReportsHubBoardProps = {
  cards: ReportOverviewCard[];
  initialLayout: DashboardLayoutRecord;
};

type SaveState = "idle" | "saving" | "saved" | "error";

export function ReportsHubBoard({ cards, initialLayout }: ReportsHubBoardProps) {
  const [layout, setLayout] = useState<DashboardLayoutRecord>(initialLayout);
  const [customizing, setCustomizing] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cardsById = useMemo(() => {
    const index = new Map<string, ReportOverviewCard>();
    cards.forEach((card) => index.set(card.id, card));
    return index;
  }, [cards]);

  const hiddenSet = useMemo(() => new Set<WidgetId>(layout.hidden), [layout.hidden]);

  const orderedVisibleCards = useMemo(() => {
    const visibleIds = layout.order.filter((id) => !hiddenSet.has(id) && cardsById.has(id));
    return visibleIds
      .map((id) => cardsById.get(id))
      .filter((card): card is ReportOverviewCard => Boolean(card));
  }, [layout.order, hiddenSet, cardsById]);

  const hiddenCards = useMemo(() => {
    return layout.order
      .filter((id) => hiddenSet.has(id) && cardsById.has(id))
      .map((id) => cardsById.get(id))
      .filter((card): card is ReportOverviewCard => Boolean(card));
  }, [layout.order, hiddenSet, cardsById]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const persistLayout = useCallback(async (next: DashboardLayoutRecord) => {
    setSaveState("saving");
    setErrorMessage(null);

    const response = await apiFetch("/api/reports/layout", {
      method: "PUT",
      body: JSON.stringify(next),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setSaveState("error");
      setErrorMessage(data?.error ?? "Failed to save layout.");
      return;
    }

    const data = (await response.json()) as { layout: DashboardLayoutRecord };
    setLayout(data.layout);
    setSaveState("saved");
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!customizing) return;
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const activeId = String(active.id) as WidgetId;
      const overId = String(over.id) as WidgetId;

      const visibleOrder = layout.order.filter(
        (id) => !hiddenSet.has(id) && cardsById.has(id),
      );
      const oldIndex = visibleOrder.indexOf(activeId);
      const newIndex = visibleOrder.indexOf(overId);
      if (oldIndex === -1 || newIndex === -1) return;

      const reorderedVisible = arrayMove(visibleOrder, oldIndex, newIndex);
      const hiddenInOrder = layout.order.filter((id) => hiddenSet.has(id));
      const nextOrder = [...reorderedVisible, ...hiddenInOrder];

      const next = { order: nextOrder, hidden: layout.hidden };
      setLayout(next);
      void persistLayout(next);
    },
    [customizing, layout, hiddenSet, cardsById, persistLayout],
  );

  const toggleHidden = useCallback(
    (id: WidgetId) => {
      const currentlyHidden = hiddenSet.has(id);
      const nextHidden = currentlyHidden
        ? layout.hidden.filter((entry) => entry !== id)
        : [...layout.hidden, id];
      const next = { order: layout.order, hidden: nextHidden };
      setLayout(next);
      void persistLayout(next);
    },
    [hiddenSet, layout, persistLayout],
  );

  const resetToDefault = useCallback(async () => {
    setSaveState("saving");
    setErrorMessage(null);

    const response = await apiFetch("/api/reports/layout", {
      method: "DELETE",
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setSaveState("error");
      setErrorMessage(data?.error ?? "Failed to reset layout.");
      return;
    }

    const data = (await response.json()) as { layout: DashboardLayoutRecord };
    setLayout(data.layout);
    setSaveState("saved");
  }, []);

  const visibleIds = orderedVisibleCards.map((card) => card.id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-slate-500 dark:text-slate-400">
          {customizing
            ? "Drag a card to reorder. Hide a card to tuck it out of the way."
            : `${orderedVisibleCards.length} visible card${orderedVisibleCards.length === 1 ? "" : "s"}.`}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <SaveIndicator state={saveState} errorMessage={errorMessage} />
          {customizing ? (
            <>
              <button
                type="button"
                onClick={resetToDefault}
                className="rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Reset to role default
              </button>
              <button
                type="button"
                onClick={() => setCustomizing(false)}
                className="rounded-full bg-slate-950 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
              >
                Done
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setCustomizing(true)}
              className="rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Customize layout
            </button>
          )}
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={visibleIds} strategy={verticalListSortingStrategy}>
          <div className="grid gap-6 xl:grid-cols-2">
            {orderedVisibleCards.map((card) => (
              <SortableReportCard
                key={card.id}
                card={card}
                customizing={customizing}
                onHide={() => toggleHidden(card.id as WidgetId)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {customizing && hiddenCards.length > 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900/60">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
            Hidden
          </p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            These cards are hidden from your hub. Restore one to put it back at the end of your layout.
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {hiddenCards.map((card) => (
              <li
                key={card.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900 dark:text-white">{card.title}</p>
                  <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                    {card.description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleHidden(card.id as WidgetId)}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Show
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {orderedVisibleCards.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          No report cards are visible. Use Customize layout to restore one.
        </div>
      ) : null}
    </div>
  );
}

function SortableReportCard({
  card,
  customizing,
  onHide,
}: {
  card: ReportOverviewCard;
  customizing: boolean;
  onHide: () => void;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: card.id,
    disabled: !customizing,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      id={card.id}
      className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              {customizing ? (
                <button
                  type="button"
                  {...attributes}
                  {...listeners}
                  aria-label={`Drag to reorder ${card.title}`}
                  className="cursor-grab rounded-full border border-slate-200 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-500 transition hover:bg-slate-100 active:cursor-grabbing dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  Drag
                </button>
              ) : null}
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                Report Group
              </p>
            </div>
            <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white">
              {card.title}
            </h3>
            <p className="mt-3 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
              {card.description}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {customizing ? (
              <button
                type="button"
                onClick={onHide}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Hide
              </button>
            ) : null}
            <Link
              href={card.href}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Open detail
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 border-b border-slate-200 px-6 py-6 sm:grid-cols-2 dark:border-slate-800">
        {card.metrics.map((metric) => (
          <div
            key={`${card.id}-${metric.label}`}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"
          >
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              {metric.label}
            </p>
            <p className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white">
              {metric.value}
            </p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{metric.detail}</p>
          </div>
        ))}
      </div>

      <div className="divide-y divide-slate-200 dark:divide-slate-800">
        {card.rows.length === 0 ? (
          <p className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400">{card.emptyMessage}</p>
        ) : (
          card.rows.map((row) => (
            <div key={`${card.id}-${row.label}-${row.value}`} className="px-6 py-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-950 dark:text-white">{row.label}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{row.detail}</p>
                </div>
                <p className="text-right text-sm font-black uppercase tracking-[0.14em] text-slate-700 dark:text-slate-200">
                  {row.value}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </article>
  );
}

function SaveIndicator({ state, errorMessage }: { state: SaveState; errorMessage: string | null }) {
  if (state === "saving") {
    return (
      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Saving...</span>
    );
  }

  if (state === "saved") {
    return (
      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Saved</span>
    );
  }

  if (state === "error") {
    return (
      <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
        {errorMessage ?? "Save failed."}
      </span>
    );
  }

  return null;
}
