"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { PlayIcon, PauseIcon, StopIcon } from "@heroicons/react/24/solid";
import Link from "next/link";

type ActiveEntryProps = {
  id: string;
  workOrderId: string;
  active: boolean;
  startedAt: string | null;
  endedAt: string | null;
  durationMinutes: number;
  pauseReason: string | null;
  workOrder: { workOrderNumber: string } | null;
};

export function GlobalTimerWidget() {
  const [entry, setEntry] = useState<ActiveEntryProps | null>(null);
  const [loading, setLoading] = useState(true);
    
  async function fetchTimer() {
    try {
      const res = await fetch("/api/time-entries?active=true");
      if (!res.ok) throw new Error("Could not fetch timer");
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setEntry(data[0]); // Tech only ever has max 1 active
      } else {
        setEntry(null);
      }
    } catch (e: unknown) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTimer();
  }, []);

  useEffect(() => {
    if (!entry || !entry.active || !!entry.pauseReason) return;
    const interval = setInterval(() => {
          }, 60000); // refresh every minute

    return () => clearInterval(interval);
  }, [entry]);

  async function handlePause() {
    if (!entry) return;
    try {
      await apiFetch(`/api/time-entries/${entry.id}/pause`, {
        method: "POST",
        body: JSON.stringify({ pauseReason: "TECH_BREAK" }) // defaulting to tech break for quick action
      });
      fetchTimer();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleResume() {
    if (!entry) return;
    try {
      await apiFetch(`/api/time-entries/${entry.id}/resume`, {
        method: "POST"
      });
      fetchTimer();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleStop() {
    if (!entry) return;
    try {
      await apiFetch(`/api/time-entries/${entry.id}/stop`, {
        method: "POST"
      });
      fetchTimer();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  if (loading) return null; // Wait for initial load
  if (!entry) return null; // Don't show anything unless there is an active timer

  // Calculate live minutes
  let liveMinutes = entry.durationMinutes;
  if (entry.active && !entry.pauseReason && entry.startedAt) {
    const start = new Date(entry.startedAt).getTime();
    const elapsed = Date.now() - start;
    liveMinutes += Math.max(0, Math.floor(elapsed / 60000));
  }

  const hours = Math.floor(liveMinutes / 60);
  const mins = liveMinutes % 60;
  const isPaused = Boolean(entry.pauseReason);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-full bg-slate-900 px-4 py-3 text-slate-50 shadow-lg dark:bg-slate-800 dark:border dark:border-slate-700">
      <div className="flex flex-col text-xs leading-tight">
        <Link href={`/work-orders/${entry.workOrderId}`} className="font-bold hover:underline">
          WO: {entry.workOrder?.workOrderNumber || entry.workOrderId.slice(0, 8)}
        </Link>
        <span className="text-slate-400">
          {isPaused ? "Paused" : "Recording time"}
        </span>
      </div>
      <div className="mx-2 font-mono text-xl font-bold tracking-tight">
        {hours}:{mins.toString().padStart(2, "0")}
      </div>
      <div className="flex items-center gap-1">
        {isPaused ? (
          <button 
            type="button"
            onClick={handleResume} 
            className="flex h-8 w-8 items-center justify-center rounded-full text-green-400 hover:bg-slate-800 hover:text-green-300"
          >
            <PlayIcon className="h-5 w-5" />
          </button>
        ) : (
          <button 
            type="button"
            onClick={handlePause} 
            className="flex h-8 w-8 items-center justify-center rounded-full text-yellow-400 hover:bg-slate-800 hover:text-yellow-300"
          >
            <PauseIcon className="h-5 w-5" />
          </button>
        )}
        <button 
          type="button"
          onClick={handleStop} 
          className="flex h-8 w-8 items-center justify-center rounded-full text-red-500 hover:bg-slate-800 hover:text-red-400"
        >
          <StopIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
