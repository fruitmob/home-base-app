"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

type TemplateInfo = {
  id: string;
  name: string;
  description: string | null;
};

export function WoTemplatePicker({ workOrderId }: { workOrderId: string }) {
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [isApplying, setIsApplying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await apiFetch("/api/wo-templates");
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates.filter((t: TemplateInfo & { active?: boolean }) => t.active));
      }
      setIsLoading(false);
    }
    load();
  }, []);

  async function handleApply() {
    if (!selectedTemplate) return;
    setIsApplying(true);
    
    const res = await apiFetch(`/api/work-orders/${workOrderId}/apply-template`, {
      method: "POST",
      body: JSON.stringify({ templateId: selectedTemplate }),
    });

    if (res.ok) {
      setSelectedTemplate("");
      router.refresh();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Failed to apply template");
    }
    setIsApplying(false);
  }

  if (isLoading) return null;
  if (templates.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <select
        value={selectedTemplate}
        onChange={(e) => setSelectedTemplate(e.target.value)}
        disabled={isApplying}
        className="block w-48 rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700"
      >
        <option value="">Apply a template...</option>
        {templates.map(t => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
      
      <button
        type="button"
        onClick={handleApply}
        disabled={!selectedTemplate || isApplying}
        className="rounded bg-indigo-50 px-2 py-1 text-sm font-semibold text-indigo-600 shadow-sm hover:bg-indigo-100 disabled:opacity-50 dark:bg-indigo-500/10 dark:text-indigo-400"
      >
        {isApplying ? "Applying..." : "Add"}
      </button>
    </div>
  );
}
