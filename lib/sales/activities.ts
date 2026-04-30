import { db } from "@/lib/db";
import { notFound } from "@/lib/core/api";
import { Role } from "@/generated/prisma/client";
import { type CurrentUser } from "@/lib/auth";

export async function findActiveActivity(id: string) {
  const activity = await db.activity.findUnique({
    where: { id },
  });

  if (!activity || activity.deletedAt !== null) {
    notFound("Activity not found.");
  }
  return activity;
}

export function canMutateActivity(user: CurrentUser, activityOwnerUserId: string | null) {
  if (
    ([
      Role.OWNER,
      Role.ADMIN,
      Role.MANAGER,
      Role.SALES_MANAGER,
      Role.SERVICE_MANAGER,
    ] as Role[]).includes(user.role)
  ) {
    return true;
  }

  if (!activityOwnerUserId) {
    return true; // Unassigned
  }

  return user.id === activityOwnerUserId;
}

export const ACTIVITY_PARENTS = [
  "leadId",
  "opportunityId",
  "customerId",
  "vehicleId",
  "caseId",
] as const;
export type ActivityParent = (typeof ACTIVITY_PARENTS)[number];

export function getActivityParentKey(
  record: Record<string, unknown>,
): ActivityParent | null {
  let found: ActivityParent | null = null;

  for (const p of ACTIVITY_PARENTS) {
    if (
      Object.prototype.hasOwnProperty.call(record, p) &&
      typeof record[p] === "string" &&
      record[p] !== ""
    ) {
      if (found) return null; // More than one parent found
      found = p;
    }
  }

  return found; // Returns specifically one parent, or null if none
}
