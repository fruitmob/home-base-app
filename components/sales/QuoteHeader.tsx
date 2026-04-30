"use client";

import { useState } from "react";
import { format } from "date-fns";
import { apiFetch } from "@/lib/api";

type QuoteHeaderProps = {
  quoteId: string;
  quoteNumber: string;
  status: "DRAFT" | "SENT" | "ACCEPTED" | "DECLINED" | "EXPIRED";
  issuedAt?: string | Date | null;
  validUntil?: string | Date | null;
  customerName: string;
  onRefresh: () => void;
};

export default function QuoteHeader({
  quoteId,
  quoteNumber,
  status,
  issuedAt,
  validUntil,
  customerName,
  onRefresh,
}: QuoteHeaderProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleAction = async (action: string) => {
    setIsUpdating(true);
    try {
      let endpoint = "";
      let method = "POST";
      let body: Record<string, unknown> | null = null;

      if (action === "send") {
        endpoint = `/api/quotes/${quoteId}/send`;
      } else if (action === "revise") {
        endpoint = `/api/quotes/${quoteId}/revise`;
      } else if (["ACCEPTED", "DECLINED", "EXPIRED"].includes(action)) {
        endpoint = `/api/quotes/${quoteId}/status`;
        method = "PATCH";
        body = { status: action };
      }

      const res = await apiFetch(endpoint, {
        method,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!res.ok) throw new Error("Failed to perform action");
      
      const data = await res.json();
      
      if (action === "revise") {
        // Redirect to new version
        window.location.href = `/quotes/${data.quote.id}`;
      } else {
        onRefresh();
      }
    } catch (e: unknown) {
      if (e instanceof Error) {
        alert((e as Error).message);
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const statusColors: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
    SENT: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    ACCEPTED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    DECLINED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    EXPIRED: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 pb-6 border-b border-gray-200 dark:border-gray-800">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          {quoteNumber}
          <span className={`text-xs font-semibold px-2 py-1 rounded-full uppercase tracking-wide ${statusColors[status] || ""}`}>
            {status}
          </span>
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Prepared for: <span className="font-medium text-gray-900 dark:text-white">{customerName}</span>
        </p>
        <div className="flex gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
          <div>
            <span className="font-medium">Issued: </span>
            {issuedAt ? format(new Date(issuedAt), "MMM d, yyyy") : "-"}
          </div>
          <div>
            <span className="font-medium">Valid Until: </span>
            {validUntil ? format(new Date(validUntil), "MMM d, yyyy") : "-"}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <a
          href={`/api/quotes/${quoteId}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          View PDF
        </a>

        {status === "DRAFT" && (
          <button
            onClick={() => handleAction("send")}
            disabled={isUpdating}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            Mark Sent
          </button>
        )}

        {status === "SENT" && (
          <>
            <button
              onClick={() => handleAction("ACCEPTED")}
              disabled={isUpdating}
              className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-md shadow-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              Accept
            </button>
            <button
              onClick={() => handleAction("DECLINED")}
              disabled={isUpdating}
              className="px-4 py-2 text-sm font-medium border border-red-300 text-red-700 dark:border-red-800 dark:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50 transition-colors"
            >
              Decline
            </button>
          </>
        )}

        {status !== "DRAFT" && (
          <button
            onClick={() => handleAction("revise")}
            disabled={isUpdating}
            className="px-4 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            title="Creates a new DRAFT copy of this quote"
          >
            Revise
          </button>
        )}
      </div>
    </div>
  );
}
