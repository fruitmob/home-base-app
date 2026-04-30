"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

type Customer = { id: string; displayName: string };

export default function NewQuotePage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // In a real app we'd want an async select or combobox here.
    // For now we'll just fetch a small list for the demo.
    fetch("/api/customers")
      .then(r => r.json())
      .then(d => setCustomers(d.customers || []))
      .catch(console.error);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) return;

    setIsSubmitting(true);
    try {
      const res = await apiFetch("/api/quotes", {
        method: "POST",
        body: JSON.stringify({ customerId }),
      });
      
      if (!res.ok) throw new Error("Failed to create quote");
      
      const data = await res.json();
      router.push(`/quotes/${data.quote.id}`);
    } catch {
      alert("Failed to create quote.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-12 px-4">
      <h1 className="text-2xl font-bold mb-6">Create New Quote</h1>
      
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Select Customer
            </label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              required
              className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="" disabled>Select a customer...</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.displayName}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => router.back()}
              className="mr-3 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !customerId}
              className="bg-blue-600 text-white px-6 py-2 rounded shadow-sm hover:bg-blue-700 font-medium disabled:opacity-50"
            >
              {isSubmitting ? "Creating..." : "Create Draft Quote"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
