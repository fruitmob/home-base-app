"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

type PartFormProps = {
  part?: {
    id: string;
    sku: string;
    name: string;
    description: string | null;
    manufacturer: string | null;
    manufacturerPartNumber: string | null;
    binLocation: string | null;
    unitOfMeasure: string;
    unitCost: number;
    reorderPoint: number;
    active: boolean;
  };
  onSuccess?: () => void;
  onCancel?: () => void;
};

export function PartForm({ part, onSuccess, onCancel }: PartFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!part;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      sku: formData.get("sku") as string,
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      manufacturer: formData.get("manufacturer") as string,
      manufacturerPartNumber: formData.get("manufacturerPartNumber") as string,
      binLocation: formData.get("binLocation") as string,
      unitOfMeasure: formData.get("unitOfMeasure") as string,
      unitCost: Number(formData.get("unitCost")),
      reorderPoint: Number(formData.get("reorderPoint")),
      active: formData.get("active") === "on",
    };

    try {
      const url = isEdit ? `/api/parts/${part.id}` : `/api/parts`;
      const method = isEdit ? "PATCH" : "POST";
      
      const response = await apiFetch(url, {
        method,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Failed to save part");
      }

      if (onSuccess) {
        onSuccess();
      } else if (!isEdit) {
        const newPart = await response.json();
        router.push(`/parts/${newPart.id}`);
      }
      
      router.refresh();
    } catch (err: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-900/5 dark:bg-zinc-900 dark:ring-zinc-800">
      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="sku" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            SKU *
          </label>
          <input
            type="text"
            id="sku"
            name="sku"
            required
            defaultValue={part?.sku ?? ""}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
        </div>

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Part Name *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            defaultValue={part?.name ?? ""}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Description
          </label>
          <input
            type="text"
            id="description"
            name="description"
            defaultValue={part?.description ?? ""}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
        </div>

        <div>
          <label htmlFor="manufacturer" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Manufacturer
          </label>
          <input
            type="text"
            id="manufacturer"
            name="manufacturer"
            defaultValue={part?.manufacturer ?? ""}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
        </div>

        <div>
          <label htmlFor="manufacturerPartNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            MPN
          </label>
          <input
            type="text"
            id="manufacturerPartNumber"
            name="manufacturerPartNumber"
            defaultValue={part?.manufacturerPartNumber ?? ""}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
        </div>

        <div>
          <label htmlFor="binLocation" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Bin Location
          </label>
          <input
            type="text"
            id="binLocation"
            name="binLocation"
            defaultValue={part?.binLocation ?? ""}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
        </div>

        <div>
          <label htmlFor="unitOfMeasure" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Unit of Measure
          </label>
          <select
            id="unitOfMeasure"
            name="unitOfMeasure"
            defaultValue={part?.unitOfMeasure ?? "each"}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          >
            <option value="each">Each</option>
            <option value="gallon">Gallon</option>
            <option value="quart">Quart</option>
            <option value="feet">Feet</option>
          </select>
        </div>

        <div>
          <label htmlFor="reorderPoint" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Reorder Point (Qty)
          </label>
          <input
            type="number"
            id="reorderPoint"
            name="reorderPoint"
            min="0"
            step="1"
            defaultValue={part?.reorderPoint ?? "0"}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
        </div>

        <div>
          <label htmlFor="unitCost" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Avg Unit Cost ($)
          </label>
          <input
            type="number"
            id="unitCost"
            name="unitCost"
            min="0"
            step="0.01"
            defaultValue={part?.unitCost ?? "0.00"}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
        </div>

        {isEdit && (
          <div className="flex items-center pt-6">
            <input
              id="active"
              name="active"
              type="checkbox"
              defaultChecked={part.active}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-700 dark:ring-offset-zinc-900"
            />
            <label htmlFor="active" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
              Active Part
            </label>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-4">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-gray-300 dark:hover:bg-zinc-700"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {isSubmitting ? "Saving..." : "Save Part"}
        </button>
      </div>
    </form>
  );
}
