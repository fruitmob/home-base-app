"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

type PartReservationPanelProps = {
  workOrderId: string;
  lineItemId?: string;
  parts: {
    id: string;
    sku: string;
    name: string;
    quantityOnHand: number;
    quantityReserved: number;
    unitCost: number;
  }[];
  onSuccess?: () => void;
};

export function PartReservationPanel({ workOrderId, lineItemId, parts, onSuccess }: PartReservationPanelProps) {
  const router = useRouter();
  const [selectedPartId, setSelectedPartId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPart = parts.find(p => p.id === selectedPartId);
  const available = selectedPart ? selectedPart.quantityOnHand - selectedPart.quantityReserved : 0;

  async function handleReserve(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPartId) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await apiFetch(`/api/part-reservations`, {
        method: "POST",
        body: JSON.stringify({
          partId: selectedPartId,
          workOrderId,
          lineItemId,
          quantity: Number(quantity)
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Failed to reserve part");
      }

      setQuantity("1");
      setSelectedPartId("");
      if (onSuccess) onSuccess();
      router.refresh();
    } catch (err: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-900/5 dark:bg-zinc-900 dark:ring-zinc-800">
      <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-2">Reserve Parts</h3>
      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </div>
      )}
      <form onSubmit={handleReserve} className="flex items-end gap-3">
        <div className="flex-1">
          <label htmlFor="partId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Part
          </label>
          <select
            id="partId"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            value={selectedPartId}
            onChange={(e) => setSelectedPartId(e.target.value)}
            required
          >
            <option value="" disabled>Select a part in stock...</option>
            {parts.map(p => (
              <option key={p.id} value={p.id} disabled={(p.quantityOnHand - p.quantityReserved) <= 0}>
                {p.sku} - {p.name} (Avail: {p.quantityOnHand - p.quantityReserved})
              </option>
            ))}
          </select>
        </div>
        <div className="w-24">
          <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Quantity
          </label>
          <input
            type="number"
            id="quantity"
            min="1"
            max={selectedPart ? available : ""}
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
        </div>
        <button
          type="submit"
          disabled={!selectedPartId || isSubmitting || Number(quantity) > available}
          className="rounded-md bg-indigo-600 px-3 py-2 h-[38px] text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
        >
          {isSubmitting ? "Reserving..." : "Reserve"}
        </button>
      </form>
    </div>
  );
}
