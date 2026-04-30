"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { PlayIcon, CheckIcon } from "@heroicons/react/24/solid";

type TimerPanelProps = {
  workOrderId: string;
};

export function TimerPanel({ workOrderId }: TimerPanelProps) {
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);

  async function handleStart() {
    setLoading(true);
    try {
      await apiFetch("/api/time-entries", {
        method: "POST",
        body: JSON.stringify({ workOrderId })
      });
      setStarted(true);
      // Wait for 3 seconds then revert to allow starting another contextually if needed,
      // though typically they have 1 active at a time so GlobalTimerWidget picks it up.
      setTimeout(() => setStarted(false), 3000);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-2 text-sm font-bold text-slate-800 dark:text-slate-100">Time Tracking</h3>
      <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
        Start tracking your time for this work order.
      </p>
      <button 
        type="button"
        onClick={handleStart} 
        disabled={loading || started}
        className={`flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-bold transition-colors disabled:opacity-50 ${
          started
            ? "border border-slate-200 bg-transparent text-slate-900 dark:border-slate-800 dark:text-slate-50"
            : "bg-slate-900 text-slate-50 hover:bg-slate-900/90 dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-slate-50/90"
        }`}
      >
        {started ? (
          <>
            <CheckIcon className="h-4 w-4 text-green-500" />
            Started!
          </>
        ) : (
          <>
            <PlayIcon className="h-4 w-4" />
            Start Timer
          </>
        )}
      </button>
    </div>
  );
}
