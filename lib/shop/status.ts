import {
  WorkOrderStatus,
  type WorkOrderStatus as WorkOrderStatusValue,
} from "@/generated/prisma/client";

export const WORK_ORDER_STATUS_ORDER: readonly WorkOrderStatusValue[] = [
  WorkOrderStatus.OPEN,
  WorkOrderStatus.IN_PROGRESS,
  WorkOrderStatus.ON_HOLD_PARTS,
  WorkOrderStatus.ON_HOLD_DELAY,
  WorkOrderStatus.QC,
  WorkOrderStatus.READY_TO_BILL,
  WorkOrderStatus.CLOSED,
] as const;

const ALLOWED_WORK_ORDER_TRANSITIONS: Record<WorkOrderStatusValue, readonly WorkOrderStatusValue[]> = {
  [WorkOrderStatus.OPEN]: [
    WorkOrderStatus.IN_PROGRESS,
    WorkOrderStatus.ON_HOLD_PARTS,
    WorkOrderStatus.ON_HOLD_DELAY,
  ],
  [WorkOrderStatus.IN_PROGRESS]: [
    WorkOrderStatus.ON_HOLD_PARTS,
    WorkOrderStatus.ON_HOLD_DELAY,
    WorkOrderStatus.QC,
    WorkOrderStatus.READY_TO_BILL,
  ],
  [WorkOrderStatus.ON_HOLD_PARTS]: [
    WorkOrderStatus.IN_PROGRESS,
    WorkOrderStatus.ON_HOLD_DELAY,
  ],
  [WorkOrderStatus.ON_HOLD_DELAY]: [
    WorkOrderStatus.IN_PROGRESS,
    WorkOrderStatus.ON_HOLD_PARTS,
  ],
  [WorkOrderStatus.QC]: [
    WorkOrderStatus.IN_PROGRESS,
    WorkOrderStatus.READY_TO_BILL,
    WorkOrderStatus.ON_HOLD_DELAY,
  ],
  [WorkOrderStatus.READY_TO_BILL]: [
    WorkOrderStatus.IN_PROGRESS,
    WorkOrderStatus.CLOSED,
  ],
  [WorkOrderStatus.CLOSED]: [],
};

export function workOrderStatusOrder(status: string): number {
  return WORK_ORDER_STATUS_ORDER.indexOf(status as WorkOrderStatusValue);
}

export function isClosedWorkOrderStatus(status: string): boolean {
  return status === WorkOrderStatus.CLOSED;
}

export function isActiveWorkOrderStatus(status: string): boolean {
  return workOrderStatusOrder(status) >= 0 && !isClosedWorkOrderStatus(status);
}

export function isHoldWorkOrderStatus(status: string): boolean {
  return status === WorkOrderStatus.ON_HOLD_PARTS || status === WorkOrderStatus.ON_HOLD_DELAY;
}

export function nextAllowedWorkOrderStatuses(current: WorkOrderStatusValue): WorkOrderStatusValue[] {
  return [...ALLOWED_WORK_ORDER_TRANSITIONS[current]];
}

export function canTransitionWorkOrder(
  current: WorkOrderStatusValue,
  next: WorkOrderStatusValue,
): boolean {
  if (current === next) {
    return false;
  }

  return ALLOWED_WORK_ORDER_TRANSITIONS[current].includes(next);
}

export class StatusTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StatusTransitionError";
  }
}

export async function validateWorkOrderStatusTransition(
  workOrderId: string,
  current: WorkOrderStatusValue,
  next: WorkOrderStatusValue,
  dbParams: { db: import("@/generated/prisma/client").PrismaClient }
): Promise<void> {
  if (!canTransitionWorkOrder(current, next)) {
    throw new StatusTransitionError(`Cannot transition work order from ${current} to ${next}`);
  }

  // Pre-requisite checks for specific statuses
  if (next === "CLOSED") {
    // Cannot close if there are active timers
    const activeTimers = await dbParams.db.timeEntry.findFirst({
      where: {
        workOrderId,
        active: true,
      },
    });

    if (activeTimers) {
      throw new StatusTransitionError("Cannot close work order with active time entries.");
    }

    // Example for parts checks in future:
    /*
    const pendingParts = await dbParams.db.partOrderLine.findFirst({
      where: {
        workOrderId,
        status: { not: "RECEIVED" }
      }
    });
    if (pendingParts) {
       throw new StatusTransitionError("Cannot close work order with unreceived ordered parts.");
    }
    */
  }
}
