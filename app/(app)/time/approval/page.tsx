"use client";

import { useEffect, useState } from "react";
import { TimeEntryTable } from "@/components/shop/TimeEntryTable";
import { apiFetch } from "@/lib/api";

export default function TimeApprovalPage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  async function fetchEntries() {
    try {
      // Get only pending (SUBMITTED) entries for approval queue
      const res = await fetch("/api/time-entries?status=SUBMITTED");
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

  async function handleApprove(id: string) {
    try {
      await apiFetch(`/api/time-entries/${id}/approve`, { method: "POST" });
      fetchEntries();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleReject(id: string, reason: string) {
    try {
      await apiFetch(`/api/time-entries/${id}/reject`, { 
        method: "POST",
        body: JSON.stringify({ rejectionReason: reason })
      });
      fetchEntries();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  if (loading) {
    return <div className="animate-pulse p-4 text-slate-500">Loading pending entries...</div>;
  }

  return (
    <section className="mx-auto max-w-7xl space-y-6 lg:p-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Time Approvals</h1>
          <p className="mt-1 flex items-center text-sm font-medium text-slate-500 dark:text-slate-400">
            Review and approve pending technician time entries.
          </p>
        </div>
      </div>
      <TimeEntryTable 
        entries={entries} 
        isManagerView={true} 
        onApprove={handleApprove} 
        onReject={handleReject} 
      />
    </section>
  );
}
