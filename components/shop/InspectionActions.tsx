"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

type Props = {
  inspectionId: string;
  currentStatus: string;
};

export function InspectionActions({ inspectionId, currentStatus }: Props) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);

  async function handleComplete() {
    setIsUpdating(true);
    await apiFetch(`/api/arrival-inspections/${inspectionId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "COMPLETE" }),
    });
    router.refresh();
    setIsUpdating(false);
  }

  async function handleReopen() {
    setIsUpdating(true);
    await apiFetch(`/api/arrival-inspections/${inspectionId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "DRAFT" }),
    });
    router.refresh();
    setIsUpdating(false);
  }

  if (currentStatus === "COMPLETE") {
    return (
      <div className="flex gap-3">
        <span className="inline-flex items-center rounded-md bg-green-100 px-3 py-2 text-sm font-medium text-green-800">
          Inspection Complete
        </span>
        <button
          onClick={handleReopen}
          disabled={isUpdating}
          className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
        >
          Reopen
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleComplete}
      disabled={isUpdating}
      className="inline-flex justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
    >
      {isUpdating ? "Completing..." : "Complete Inspection"}
    </button>
  );
}
