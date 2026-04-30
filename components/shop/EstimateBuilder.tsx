"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

type Customer = { id: string; firstName: string | null; lastName: string | null; displayName: string | null };

export function EstimateBuilder({ customers }: { customers: Customer[] }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    const formData = new FormData(e.currentTarget);

    try {
      const res = await apiFetch("/api/estimates", {
        method: "POST",
        body: JSON.stringify({
          customerId: formData.get("customerId"),
          title: formData.get("title"),
          notes: formData.get("notes") || "",
        }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to create estimate");
      }

      const { estimate } = await res.json();
      router.push(`/estimates/${estimate.id}`);
      router.refresh();
    } catch (error) {
      setError((error as Error).message);
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl bg-white p-6 rounded-lg shadow ring-1 ring-gray-900/5 dark:bg-zinc-900 dark:ring-zinc-800">
      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-900 dark:text-zinc-300">
          Estimate Title
        </label>
        <div className="mt-2">
          <input
            type="text"
            name="title"
            id="title"
            required
            className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700"
            placeholder="e.g. Front End Rebuild"
          />
        </div>
      </div>

      <div>
        <label htmlFor="customerId" className="block text-sm font-medium text-gray-900 dark:text-zinc-300">
          Customer
        </label>
        <div className="mt-2">
          <select
            name="customerId"
            id="customerId"
            required
            className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700"
            defaultValue=""
          >
            <option value="" disabled>Select a customer...</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>
                {c.displayName || `${c.firstName} ${c.lastName}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-900 dark:text-zinc-300">
          Internal Notes & Complaint
        </label>
        <div className="mt-2">
          <textarea
            name="notes"
            id="notes"
            rows={4}
            className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700"
          />
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
        >
          {isSubmitting ? "Creating..." : "Create Estimate"}
        </button>
      </div>
    </form>
  );
}
