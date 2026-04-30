"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Estimate, EstimateLineItem, Vehicle } from "@/generated/prisma/client";

type EstimateWithDetails = Estimate & {
  lineItems: EstimateLineItem[];
  vehicle: Vehicle | null;
};

export default function PortalEstimatesPanel({
  estimates,
  token,
}: {
  estimates: EstimateWithDetails[];
  token: string;
}) {
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const handleApprove = async (id: string) => {
    setApprovingId(id);
    try {
      const res = await fetch(`/api/portal/${token}/estimates/${id}/approve`, {
        method: "POST",
      });
      if (res.ok) {
        window.location.reload();
      } else {
        alert("Failed to approve estimate. Please contact the shop.");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred.");
    } finally {
      setApprovingId(null);
    }
  };

  if (estimates.length === 0) return null;

  return (
    <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-800">
      <h2 className="text-xl font-semibold flex items-center">
        <svg
          className="w-5 h-5 mr-2 text-orange-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        Pending Approvals
      </h2>

      <div className="space-y-4">
        {estimates.map((est) => {
          const total = est.lineItems.reduce(
            (sum, item) => sum + Number(item.unitPrice) * Number(item.quantity),
            0
          );

          return (
            <div
              key={est.id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-orange-200 dark:border-orange-900/50 overflow-hidden"
            >
              <div className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold">
                      Estimate EST-{est.id.slice(-6).toUpperCase()}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {est.vehicle
                        ? `${est.vehicle.year} ${est.vehicle.make} ${est.vehicle.model}`
                        : "General Service"}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
                      ${total.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500">
                      Issued {format(new Date(est.createdAt), "MMM d")}
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 mb-4 space-y-2">
                  {est.lineItems.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300">
                        {item.description} {Number(item.quantity) > 1 && `(x${item.quantity})`}
                      </span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        ${(Number(item.unitPrice) * Number(item.quantity)).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => handleApprove(est.id)}
                    disabled={approvingId === est.id}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    {approvingId === est.id ? "Approving..." : "Approve Estimate"}
                  </button>
                  <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-medium transition-colors">
                    Download PDF
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
