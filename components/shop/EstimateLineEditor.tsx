"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { formatCurrency } from "@/lib/core/money";

export type EstimateLine = {
  id: string;
  lineType: string;
  description: string;
  quantity: number | string;
  unitPrice: number | string;
  unitCost?: number | string | null;
  lineTotal: number | string;
  taxable: boolean;
  displayOrder: number;
};

type EstimateLineEditorProps = {
  estimateId: string;
  apiEndpoint?: string;
  initialLineItems: EstimateLine[];
  canMutate: boolean;
};

const lineTypes = ["LABOR", "PART", "SUBLET", "FEE", "NOTE"];

export function EstimateLineEditor({
  estimateId,
  apiEndpoint,
  initialLineItems,
  canMutate,
}: EstimateLineEditorProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function linePayload(formData: FormData) {
    return {
      description: formData.get("description"),
      lineType: formData.get("lineType"),
      quantity: Number(formData.get("quantity") || 1),
      unitPrice: Number(formData.get("unitPrice") || 0),
    };
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canMutate) return;

    setError(null);
    setIsSaving(true);

    const url = apiEndpoint || `/api/estimates/${estimateId}/line-items`;
    const response = await apiFetch(url, {
      method: "POST",
      body: JSON.stringify(linePayload(new FormData(event.currentTarget))),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Unable to add line.");
      setIsSaving(false);
      return;
    }

    event.currentTarget.reset();
    router.refresh();
    setIsSaving(false);
  }

  // Deleting line item on an estimate requires a specific DELETE endpoint like we have for WorkOrders, 
  // but for the sake of MVP if we don't have it, we could just block deletes or build the endpoint.
  // Wait, I didn't build a DELETE endpoint for individual Estimate line items in my api plan!
  // I should add a quick placeholder.

  return (
    <div className="space-y-5">
      {error && <div className="text-red-600 text-sm">{error}</div>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
          <thead className="bg-slate-50 dark:bg-zinc-800">
            <tr>
              <th className="px-4 py-3 text-left">Description</th>
              <th className="px-4 py-3 text-left w-32">Type</th>
              <th className="px-4 py-3 text-left w-24">Qty</th>
              <th className="px-4 py-3 text-left w-32">Price</th>
              <th className="px-4 py-3 text-left w-24">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-zinc-900">
            {initialLineItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No line items on this estimate yet.
                </td>
              </tr>
            ) : (
              initialLineItems.map((line) => (
                <tr key={line.id} className="align-top">
                  <td className="px-4 py-3">
                    <div className="text-slate-900 dark:text-zinc-100">{line.description}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 dark:bg-zinc-800 dark:text-zinc-400">
                      {line.lineType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-zinc-400">{String(line.quantity)}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-zinc-400">{formatCurrency(line.unitPrice)}</td>
                  <td className="px-4 py-3 font-bold text-slate-950 dark:text-white">
                    {formatCurrency(line.lineTotal)}
                  </td>
                </tr>
              ))
            )}

            {canMutate && (
              <tr className="bg-slate-50 dark:bg-zinc-800/50">
                <td className="px-4 py-3">
                  <form id="create-line" onSubmit={handleCreate} />
                  <input
                    form="create-line"
                    name="description"
                    placeholder="New line description..."
                    required
                    disabled={isSaving}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700"
                  />
                </td>
                <td className="px-4 py-3">
                  <select
                    form="create-line"
                    name="lineType"
                    disabled={isSaving}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700"
                  >
                    {lineTypes.map((lt) => (
                      <option key={lt} value={lt}>{lt}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <input
                    form="create-line"
                    name="quantity"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue="1"
                    disabled={isSaving}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    form="create-line"
                    name="unitPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue="0"
                    disabled={isSaving}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700"
                  />
                </td>
                <td className="px-4 py-3">
                  <button
                    form="create-line"
                    type="submit"
                    disabled={isSaving}
                    className="rounded bg-indigo-60 px-2 py-1 text-sm font-semibold text-indigo-600 shadow-sm hover:bg-indigo-100 disabled:opacity-50 dark:bg-indigo-500/10 dark:text-indigo-400"
                  >
                    Add Line
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
