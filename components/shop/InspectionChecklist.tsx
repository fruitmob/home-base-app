"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

type InspectionItem = {
  id: string;
  label: string;
  category: string | null;
  result: "PASS" | "FAIL" | "ATTENTION" | "NOT_APPLICABLE";
  notes: string | null;
  displayOrder: number;
};

export function InspectionChecklist({ inspectionId, items: initialItems, status }: { inspectionId: string, items: InspectionItem[], status: string }) {
  const router = useRouter();
  const [items, setItems] = useState<InspectionItem[]>(initialItems);
  const isComplete = status === "COMPLETE";

  async function handleResultChange(id: string, newResult: string) {
    // Optimistic update
    setItems(items.map(i => i.id === id ? { ...i, result: newResult as any /* eslint-disable-line @typescript-eslint/no-explicit-any */ } : i));
    
    await apiFetch(`/api/inspection-items/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ result: newResult }),
    });
    router.refresh();
  }

  async function handleNotesChange(id: string, newNotes: string) {
    setItems(items.map(i => i.id === id ? { ...i, notes: newNotes } : i));
    
    await apiFetch(`/api/inspection-items/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ notes: newNotes }),
    });
    router.refresh();
  }

  async function addDefaultItems() {
    const defaults = [
      { label: "Wiper Blades", category: "Exterior", result: "NOT_APPLICABLE" },
      { label: "Tire Tread Depth", category: "Exterior", result: "NOT_APPLICABLE" },
      { label: "Battery Health", category: "Under Hood", result: "NOT_APPLICABLE" },
      { label: "Brake Pads", category: "Undercarriage", result: "NOT_APPLICABLE" },
    ];
    
    await apiFetch(`/api/arrival-inspections/${inspectionId}/items`, {
      method: "POST",
      body: JSON.stringify(defaults),
    });
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-10 rounded-md border-2 border-dashed border-zinc-300 dark:border-zinc-700">
        <h3 className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">No items available</h3>
        <p className="mt-1 text-sm text-zinc-500">Get started by loading a standard checklist.</p>
        <div className="mt-6">
          <button onClick={addDefaultItems} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500">
            Load Default Checklist
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.id} className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <h4 className="font-medium text-slate-900 dark:text-zinc-100">{item.label}</h4>
            {item.category && <p className="text-sm text-slate-500 dark:text-zinc-400">{item.category}</p>}
          </div>
          
          <div className="flex items-center gap-2">
            <select
              value={item.result}
              disabled={isComplete}
              onChange={(e) => handleResultChange(item.id, e.target.value)}
              className={`block w-40 rounded-md border-0 py-1.5 pl-3 pr-10 sm:text-sm sm:leading-6 focus:ring-2 focus:ring-indigo-600 ${
                item.result === "PASS" ? "bg-green-50 text-green-700 ring-green-200" :
                item.result === "FAIL" ? "bg-red-50 text-red-700 ring-red-200" :
                item.result === "ATTENTION" ? "bg-yellow-50 text-yellow-700 ring-yellow-200" :
                "bg-white text-gray-900 ring-gray-300 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700"
              } ring-1 ring-inset`}
            >
              <option value="NOT_APPLICABLE">N/A</option>
              <option value="PASS">Pass</option>
              <option value="FAIL">Fail</option>
              <option value="ATTENTION">Needs Attention</option>
            </select>
          </div>

          <div className="w-full sm:w-64">
            <input
              type="text"
              placeholder="Add notes..."
              value={item.notes || ""}
              disabled={isComplete}
              onChange={(e) => setItems(items.map(i => i.id === item.id ? { ...i, notes: e.target.value } : i))}
              onBlur={(e) => handleNotesChange(item.id, e.target.value)}
              className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
