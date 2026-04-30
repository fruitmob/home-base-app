"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

type Props = {
  claim: {
    id: string;
    status: string;
    claimNumber: string | null;
    title: string;
    description: string | null;
    recoveryAmount: string | null;
  };
};

export function WarrantyClaimForm({ claim }: Props) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);
  const [formData, setFormData] = useState({
    title: claim.title,
    claimNumber: claim.claimNumber || "",
    description: claim.description || "",
    recoveryAmount: claim.recoveryAmount || "",
    status: claim.status,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsUpdating(true);
    
    // Convert to null if empty, convert recoveryAmount to number tracking
    const body: any /* eslint-disable-line @typescript-eslint/no-explicit-any */ = {
      title: formData.title,
      status: formData.status,
    };
    if (formData.claimNumber) body.claimNumber = formData.claimNumber;
    else body.claimNumber = null;
    
    if (formData.description) body.description = formData.description;
    else body.description = null;
    
    if (formData.recoveryAmount) body.recoveryAmount = Number(formData.recoveryAmount);
    else body.recoveryAmount = null;

    await apiFetch(`/api/warranty-claims/${claim.id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    router.refresh();
    setIsUpdating(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
        <div className="sm:col-span-4">
          <label htmlFor="title" className="block text-sm font-medium leading-6 text-slate-900 dark:text-zinc-100">
            Title
          </label>
          <div className="mt-2">
            <input
              type="text"
              name="title"
              id="title"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="block w-full rounded-md border-0 py-1.5 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-zinc-800 dark:ring-zinc-700 dark:text-zinc-100"
            />
          </div>
        </div>

        <div className="sm:col-span-3">
          <label htmlFor="claimNumber" className="block text-sm font-medium leading-6 text-slate-900 dark:text-zinc-100">
            Claim / Case Number
          </label>
          <div className="mt-2">
            <input
              type="text"
              name="claimNumber"
              id="claimNumber"
              value={formData.claimNumber}
              onChange={(e) => setFormData({ ...formData, claimNumber: e.target.value })}
              className="block w-full rounded-md border-0 py-1.5 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-zinc-800 dark:ring-zinc-700 dark:text-zinc-100"
            />
          </div>
        </div>

        <div className="sm:col-span-3">
          <label htmlFor="status" className="block text-sm font-medium leading-6 text-slate-900 dark:text-zinc-100">
            Status
          </label>
          <div className="mt-2">
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="block w-full rounded-md border-0 py-1.5 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-zinc-800 dark:ring-zinc-700 dark:text-zinc-100"
            >
              <option value="OPEN">Open</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="RECOVERED">Recovered</option>
              <option value="DENIED">Denied</option>
            </select>
          </div>
        </div>

        <div className="col-span-full">
          <label htmlFor="description" className="block text-sm font-medium leading-6 text-slate-900 dark:text-zinc-100">
            Description / Notes
          </label>
          <div className="mt-2">
            <textarea
              id="description"
              name="description"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="block w-full rounded-md border-0 py-1.5 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-zinc-800 dark:ring-zinc-700 dark:text-zinc-100"
            />
          </div>
        </div>

        {formData.status === "RECOVERED" && (
          <div className="sm:col-span-3">
            <label htmlFor="recoveryAmount" className="block text-sm font-medium leading-6 text-slate-900 dark:text-zinc-100">
              Recovery Amount ($)
            </label>
            <div className="mt-2">
              <input
                type="number"
                step="0.01"
                min="0"
                name="recoveryAmount"
                id="recoveryAmount"
                value={formData.recoveryAmount}
                onChange={(e) => setFormData({ ...formData, recoveryAmount: e.target.value })}
                className="block w-full rounded-md border-0 py-1.5 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-green-600 sm:text-sm sm:leading-6 dark:bg-zinc-800 dark:ring-zinc-700 dark:text-zinc-100"
                required
              />
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-end gap-x-6">
        <button
          type="submit"
          disabled={isUpdating}
          className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
        >
          {isUpdating ? "Saving..." : "Save Claim Details"}
        </button>
      </div>
    </form>
  );
}
