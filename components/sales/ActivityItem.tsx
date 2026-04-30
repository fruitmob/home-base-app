"use client";

import { formatDistanceToNow, format } from "date-fns";
import { useState } from "react";
import { apiFetch } from "@/lib/api";

type ActivityWithUser = {
  id: string;
  type: string;
  status: string;
  subject: string;
  body: string | null;
  dueAt: Date | string | null;
  completedAt: Date | string | null;
  createdAt: Date | string;
  ownerUser: { id: string; email: string } | null;
};

interface ActivityItemProps {
  activity: ActivityWithUser;
  onUpdate: () => void;
}

export function ActivityItem({ activity, onUpdate }: ActivityItemProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  async function handleMarkComplete() {
    setIsUpdating(true);
    try {
      await apiFetch(`/api/activities/${activity.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "COMPLETED" }),
      });
      onUpdate();
    } catch {
      alert("Failed to mark complete.");
    } finally {
      setIsUpdating(false);
    }
  }

  const isCompleted = activity.status === "COMPLETED";
  const isCanceled = activity.status === "CANCELED";
  
  const iconMap: Record<string, string> = {
    CALL: "📞",
    EMAIL: "✉️",
    MEETING: "👥",
    TASK: "✅",
    NOTE: "📝",
  };

  const name = activity.ownerUser 
    ? activity.ownerUser.email
    : "System";

  return (
    <div className={`p-4 rounded-lg border ${
      isCompleted ? 'bg-gray-50/50 border-gray-200 dark:bg-gray-800/20 dark:border-gray-800' : 'bg-white border-gray-200 shadow-sm dark:bg-gray-900 dark:border-gray-800'
    }`}>
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl" title={activity.type}>{iconMap[activity.type]}</span>
          <div>
            <h4 className={`font-medium ${isCompleted ? 'line-through text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>
              {activity.subject}
            </h4>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {name} • {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
            </div>
          </div>
        </div>
        
        {activity.status === "OPEN" && activity.type !== "NOTE" && (
          <button
            onClick={handleMarkComplete}
            disabled={isUpdating}
            className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-400 dark:hover:bg-blue-900/60 transition-colors disabled:opacity-50"
          >
            Mark Complete
          </button>
        )}
        
        {isCompleted && (
          <span className="text-xs px-2 py-1 rounded bg-green-50 text-green-600 dark:bg-green-900/40 dark:text-green-400">
            Completed
          </span>
        )}
        
        {isCanceled && (
          <span className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 dark:bg-red-900/40 dark:text-red-400">
            Canceled
          </span>
        )}
      </div>

      {activity.dueAt && activity.status === "OPEN" && (
        <div className="mb-2 text-xs font-medium text-orange-600 dark:text-orange-400">
          Due: {format(new Date(activity.dueAt), "MMM d, yyyy")}
        </div>
      )}

      {activity.body && (
        <div className="mt-3 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap pl-7">
          {activity.body}
        </div>
      )}
    </div>
  );
}
