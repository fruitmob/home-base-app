"use client";

import { useEffect, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { apiFetch } from "@/lib/api";

export type LineItem = {
  id: string;
  productId: string | null;
  sku: string | null;
  description: string;
  quantity: string | number | { toString(): string };
  unitPrice: string | number | { toString(): string } | null;
  lineTotal?: string | number | { toString(): string } | null; 
  taxable: boolean;
  displayOrder: number;
};

type QuoteLineEditorProps = {
  parentId: string; // quoteId or templateId
  initialLineItems: LineItem[];
  isEditable: boolean;
  onRefresh: () => void;
  collectionEndpoint: string; // e.g. `/api/quotes/${quoteId}/line-items`
  itemEndpointBase: string; // e.g. `/api/quote-line-items`
  showTotals?: boolean; // false for templates
};

function SortableItem({
  item,
  isEditable,
  onUpdate,
  onDelete,
  showTotals,
}: {
  item: LineItem;
  isEditable: boolean;
  onUpdate: (id: string, updates: Partial<LineItem>) => void;
  onDelete: (id: string) => void;
  showTotals: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    boxShadow: isDragging ? "0 5px 15px rgba(0,0,0,0.1)" : "none",
  };

  const gridCols = showTotals 
    ? "grid-cols-[20px_1fr_80px_100px_100px_40px]" 
    : "grid-cols-[20px_1fr_80px_100px_40px]";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`grid ${gridCols} gap-4 items-center p-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 group ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <div
        {...attributes}
        {...listeners}
        className={`cursor-grab flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 ${!isEditable && "hidden"}`}
      >
        <svg fill="currentColor" viewBox="0 0 16 16" width="16" height="16">
          <path d="M4.5 4a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm0 5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm0 5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm7-10a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm0 5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm0 5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
        </svg>
      </div>
      <div>
        {isEditable ? (
          <input
            type="text"
            value={item.description}
            onChange={(e) => onUpdate(item.id, { description: e.target.value })}
            className="w-full bg-transparent border border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-blue-500 rounded px-2 py-1 text-sm outline-none"
            placeholder="Description..."
          />
        ) : (
          <div className="px-2 text-sm">{item.description}</div>
        )}
      </div>
      <div>
        {isEditable ? (
          <input
            type="number"
            min="0"
            step="1"
            value={Number(item.quantity)}
            onChange={(e) => onUpdate(item.id, { quantity: Number(e.target.value) })}
            className="w-full bg-transparent border border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-blue-500 rounded px-2 py-1 text-sm outline-none text-right"
          />
        ) : (
          <div className="px-2 text-sm text-right">{Number(item.quantity)}</div>
        )}
      </div>
      <div>
        {isEditable ? (
          <input
            type="number"
            min="0"
            step="0.01"
            value={Number(item.unitPrice)}
            onChange={(e) => onUpdate(item.id, { unitPrice: Number(e.target.value) })}
            className="w-full bg-transparent border border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-blue-500 rounded px-2 py-1 text-sm outline-none text-right"
          />
        ) : (
          <div className="px-2 text-sm text-right">${Number(item.unitPrice).toFixed(2)}</div>
        )}
      </div>
      {showTotals && (
        <div className="font-medium text-right pr-2">
          ${Number(item.lineTotal || 0).toFixed(2)}
        </div>
      )}
      <div>
        {isEditable && (
          <button
            onClick={() => onDelete(item.id)}
            className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-opacity p-1"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

export default function QuoteLineEditor({ 
  initialLineItems, 
  isEditable, 
  onRefresh,
  collectionEndpoint,
  itemEndpointBase,
  showTotals = true
}: QuoteLineEditorProps) {
  const [items, setItems] = useState<LineItem[]>(initialLineItems);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setItems(initialLineItems);
  }, [initialLineItems]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);

      const newItems = arrayMove(items, oldIndex, newIndex);
      setItems(newItems);

      // Async save the new order
      try {
        const orderMap = newItems.reduce((acc, item, idx) => {
          acc[item.id] = idx;
          return acc;
        }, {} as Record<string, number>);

        await apiFetch(collectionEndpoint, {
          method: "PUT",
          body: JSON.stringify({ order: orderMap }),
        });
        
        onRefresh();
      } catch (e) {
        console.error("Failed to reorder array", e);
      }
    }
  };

  const handleUpdate = async (id: string, updates: Partial<LineItem>) => {
    // Optimistic UI update
    setItems((curr) =>
      curr.map((i) => {
        if (i.id === id) {
          const merged = { ...i, ...updates };
          // Optimistically compute line totals
          if (showTotals) {
             merged.lineTotal = Number(merged.quantity) * Number(merged.unitPrice);
          }
          return merged;
        }
        return i;
      })
    );

    try {
      await apiFetch(`${itemEndpointBase}/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      // Delay refresh to allow DB to catch up triggers / line totals parent
    } catch (e) {
      console.error(e);
      onRefresh(); // Revert on failure
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this line?")) return;
    setItems((curr) => curr.filter((i) => i.id !== id));
    try {
      await apiFetch(`${itemEndpointBase}/${id}`, {
        method: "DELETE",
      });
      onRefresh();
    } catch (e) {
      console.error(e);
      onRefresh();
    }
  };

  const handleAddBlank = async () => {
    try {
      setIsSaving(true);
      await apiFetch(collectionEndpoint, {
        method: "POST",
        body: JSON.stringify({
          description: "New Item",
          quantity: 1,
          unitPrice: 0,
          displayOrder: items.length,
        }),
      });
      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const gridCols = showTotals 
    ? "grid-cols-[20px_1fr_80px_100px_100px_40px]" 
    : "grid-cols-[20px_1fr_80px_100px_40px]";

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div className={`grid ${gridCols} gap-4 p-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-500 uppercase tracking-wider`}>
        <div className={!isEditable ? "hidden" : ""}></div>
        <div>Description</div>
        <div className="text-right">Qty</div>
        <div className="text-right">Price</div>
        {showTotals && <div className="text-right">Total</div>}
        <div></div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col min-h-[100px]">
             {items.length === 0 && (
                <div className="p-8 text-center text-gray-500 text-sm">No line items. Add some to get started.</div>
             )}
            {items.map((item) => (
              <SortableItem
                key={item.id}
                item={item}
                isEditable={isEditable}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                showTotals={showTotals}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {isEditable && (
        <div className="p-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleAddBlank}
            disabled={isSaving}
            className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            + Add Line Item
          </button>
        </div>
      )}
    </div>
  );
}
