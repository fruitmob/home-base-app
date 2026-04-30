"use client";

import { useState } from "react";
// removed prisma import
import { apiFetch } from "@/lib/api";
import type { ActivityParent } from "@/lib/sales/activities";

interface ActivityComposerProps {
  parentKey: ActivityParent;
  parentId: string;
  onSuccess: () => void;
}

export function ActivityComposer({ parentKey, parentId, onSuccess }: ActivityComposerProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  
  const [type, setType] = useState<string>("NOTE");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [dueAt, setDueAt] = useState("");

  const needsDueDate = type !== "NOTE";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim()) {
      setError("Subject is required.");
      return;
    }
    
    setIsSubmitting(true);
    setError("");

    try {
      await apiFetch("/api/activities", {
        method: "POST",
        body: JSON.stringify({
          [parentKey]: parentId,
          type,
          subject,
          body,
          ...(dueAt ? { dueAt } : {}),
        }),
      });

      // Reset form on success
      setType("NOTE");
      setSubject("");
      setBody("");
      setDueAt("");
      
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create activity.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="bg-white border rounded-lg p-4 shadow-sm dark:bg-gray-900 dark:border-gray-800">
      <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">Log Activity</h3>
      
      {error && (
        <div className="mb-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-4">
          <div className="w-1/3">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded border-gray-300 shadow-sm text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200"
            >
              <option value="NOTE">Note</option>
              <option value="CALL">Call</option>
              <option value="MEETING">Meeting</option>
              <option value="EMAIL">Email</option>
              <option value="TASK">Task</option>
            </select>
          </div>
          <div className="w-2/3">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={type === "NOTE" ? "Note subject..." : "Task subject..."}
              className="w-full rounded border-gray-300 shadow-sm text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Details
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="Log your notes here..."
            className="w-full rounded border-gray-300 shadow-sm text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200"
          />
        </div>

        {needsDueDate && (
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Due Date (Optional)
            </label>
            <input
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="rounded border-gray-300 shadow-sm text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200"
            />
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting || !subject.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? "Saving..." : "Save Activity"}
          </button>
        </div>
      </form>
    </div>
  );
}
