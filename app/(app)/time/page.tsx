"use client";

import { useEffect, useState } from "react";
import { TimeEntryTable } from "@/components/shop/TimeEntryTable";
import { apiFetch } from "@/lib/api";

export default function MyTimePage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  async function fetchEntries() {
    try {
      // By default GET /api/time-entries without workOrderId returns index for caller.
      // API forces user.id if not elevated, but we can explicitly pass it or let API handle.
      const res = await fetch("/api/time-entries");
      if (!res.ok) throw new Error("Failed to fetch");
      setEntries(await res.json());
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchEntries();
  }, []);

  async function handleSubmit(id: string) {
    try {
      await apiFetch(`/api/time-entries/${id}/submit`, { method: "POST" });
      fetchEntries();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  if (loading) {
    return <div className="animate-pulse p-4 text-slate-500">Loading your time entries...</div>;
  }

  return (
    <section className="mx-auto max-w-7xl space-y-6 lg:p-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">My Time</h1>
          <p className="mt-1 flex items-center text-sm font-medium text-slate-500 dark:text-slate-400">
            View your recent time entries and submit them for approval.
          </p>
        </div>
      </div>
      <TimeEntryTable entries={entries} onSubmit={handleSubmit} />
    </section>
  );
}
