"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

type ChangeOrderActionsProps = {
  coId: string;
  status: string;
};

export function ChangeOrderActions({ coId, status }: ChangeOrderActionsProps) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);

  async function updateStatus(newStatus: string) {
    if (!window.confirm(`Are you sure you want to mark this change order as ${newStatus}?`)) return;
    
    setIsProcessing(true);
    const res = await apiFetch(`/api/change-orders/${coId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: newStatus }),
    });

    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Failed to update status");
    }
    setIsProcessing(false);
  }

  return (
    <div className="flex gap-2">
      {status === "DRAFT" && (
        <button
          onClick={() => updateStatus("SENT")}
          disabled={isProcessing}
          className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-700"
        >
          Mark as Sent
        </button>
      )}
      
      {status === "SENT" && (
        <>
          <button
            onClick={() => updateStatus("DECLINED")}
            disabled={isProcessing}
            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-red-600 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50 dark:bg-zinc-800 dark:text-red-400 dark:ring-zinc-700 dark:hover:bg-zinc-700"
          >
            Decline
          </button>
          <button
            onClick={() => updateStatus("APPROVED")}
            disabled={isProcessing}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
          >
            Approve Change Order
          </button>
        </>
      )}
    </div>
  );
}
