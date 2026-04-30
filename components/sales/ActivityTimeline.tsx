"use client";

import { useEffect, useState, useCallback } from "react";
import { ActivityComposer } from "./ActivityComposer";
import { ActivityItem } from "./ActivityItem";
import type { ActivityParent } from "@/lib/sales/activities";

interface ActivityTimelineProps {
  parentKey: ActivityParent;
  parentId: string;
  canCompose?: boolean;
}

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

export function ActivityTimeline({ parentKey, parentId, canCompose = true }: ActivityTimelineProps) {
  const [activities, setActivities] = useState<ActivityWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchActivities = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/activities?${parentKey}=${parentId}`);
      if (!res.ok) {
        throw new Error("Failed to load activities");
      }
      const data = await res.json();
      setActivities(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [parentKey, parentId]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  return (
    <div className="space-y-6">
      {canCompose ? (
        <ActivityComposer 
          parentKey={parentKey} 
          parentId={parentId} 
          onSuccess={fetchActivities} 
        />
      ) : null}

      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Timeline</h3>
        
        {isLoading ? (
          <div className="text-sm text-gray-500 animate-pulse">Loading activities...</div>
        ) : error ? (
          <div className="text-sm text-red-500">{error}</div>
        ) : activities.length === 0 ? (
          <div className="text-sm text-gray-500 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800/20 p-4 rounded-lg border border-gray-100 dark:border-gray-800">
            No activities yet.
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => (
              <ActivityItem 
                key={activity.id} 
                activity={activity} 
                onUpdate={fetchActivities} 
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
