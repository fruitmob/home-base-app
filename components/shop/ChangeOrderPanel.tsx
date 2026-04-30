"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { formatCurrency } from "@/lib/core/money";

type ChangeOrderInfo = {
  id: string;
  changeOrderNumber: string;
  title: string;
  status: string;
  total: number | string;
};

export function ChangeOrderPanel({ workOrderId, changeOrders }: { workOrderId: string, changeOrders: ChangeOrderInfo[] }) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);

  async function createChangeOrder() {
    setIsCreating(true);
    const res = await apiFetch(`/api/change-orders`, {
      method: "POST",
      body: JSON.stringify({
        workOrderId,
        title: "New Change Order",
      }),
    });

    if (res.ok) {
      const data = await res.json();
      router.push(`/change-orders/${data.changeOrder.id}`);
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Failed to create change order");
      setIsCreating(false);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
            Change Orders
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            In-flight approvals for additional work.
          </p>
        </div>
        <button
          onClick={createChangeOrder}
          disabled={isCreating}
          className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-700"
        >
          {isCreating ? "Creating..." : "New Change Order"}
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {changeOrders.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-sm text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No change orders for this work order.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800 bg-white dark:bg-zinc-900">
              <thead className="bg-slate-50 dark:bg-zinc-800">
                <tr>
                  <th className="px-4 py-3 text-left">CO #</th>
                  <th className="px-4 py-3 text-left">Title</th>
                  <th className="px-4 py-3 text-left">Total</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {changeOrders.map((co) => (
                  <tr key={co.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800">
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/change-orders/${co.id}`} className="text-indigo-600 dark:text-indigo-400 hover:underline">
                        {co.changeOrderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-900 dark:text-zinc-100">{co.title}</td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{formatCurrency(Number(co.total))}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                        co.status === "APPROVED" ? "bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-500/10 dark:text-green-400 dark:ring-green-500/20" :
                        co.status === "DRAFT" ? "bg-gray-50 text-gray-700 ring-gray-600/20 dark:bg-zinc-500/10 dark:text-zinc-400 dark:ring-zinc-500/20" :
                        co.status === "DECLINED" ? "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/20" :
                        "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20"
                      }`}>
                        {co.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
