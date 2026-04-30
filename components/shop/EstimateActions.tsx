"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

type EstimateProps = {
  id: string;
  status: string;
  convertedWorkOrderId: string | null;
};

export function EstimateActions({ estimate }: { estimate: EstimateProps }) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);

  async function updateStatus(newStatus: string) {
    if (!window.confirm(`Are you sure you want to mark this estimate as ${newStatus}?`)) return;
    
    setIsProcessing(true);
    const res = await apiFetch(`/api/estimates/${estimate.id}/status`, {
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

  async function convertToWorkOrder() {
    if (!window.confirm("Convert this estimate into an active Work Order?")) return;
    
    setIsProcessing(true);
    const res = await apiFetch(`/api/estimates/${estimate.id}/convert-to-work-order`, {
      method: "POST",
    });

    if (res.ok) {
      const { workOrder } = await res.json();
      router.push(`/work-orders/${workOrder.id}`);
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Failed to convert estimate");
      setIsProcessing(false);
    }
  }

  return (
    <div className="flex gap-2">
      {estimate.status === "DRAFT" && (
        <button
          onClick={() => updateStatus("SENT")}
          disabled={isProcessing}
          className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-700"
        >
          Mark as Sent
        </button>
      )}
      
      {estimate.status === "SENT" && (
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
            Approve Estimate
          </button>
        </>
      )}

      {estimate.status === "APPROVED" && !estimate.convertedWorkOrderId && (
        <button
          onClick={convertToWorkOrder}
          disabled={isProcessing}
          className="rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 disabled:opacity-50"
        >
          Convert to Work Order
        </button>
      )}
    </div>
  );
}
