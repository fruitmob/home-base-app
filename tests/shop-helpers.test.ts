import assert from "node:assert/strict";
import {
  PartTransactionType,
  Role,
  TimeEntryStatus,
  TimePauseReason,
  WorkOrderStatus,
} from "@/generated/prisma/client";
import {
  canApproveTimeEntries,
  canWriteEstimates,
  canWriteInspections,
  canWritePartsInventory,
  canWriteTimeEntries,
  canWriteWarrantyClaims,
  canWriteWorkOrders,
} from "@/lib/core/permissions";
import { ValidationError } from "@/lib/core/validators";
import {
  adjustQuantityOnHand,
  availableQuantity,
  canReserveQuantity,
  isLowStock,
  issueReservedQuantity,
  receiveQuantity,
  releaseReservedQuantity,
  reserveQuantity,
  transactionAffectsOnHand,
} from "@/lib/shop/inventory";
import {
  buildShopNumber,
  extractShopNumberSequence,
} from "@/lib/shop/numbering";
import {
  canTransitionWorkOrder,
  isActiveWorkOrderStatus,
  isClosedWorkOrderStatus,
  isHoldWorkOrderStatus,
  nextAllowedWorkOrderStatuses,
  workOrderStatusOrder,
} from "@/lib/shop/status";
import {
  canPauseTimer,
  canResumeTimer,
  canStopTimer,
  canTransitionTimeEntryStatus,
  isActiveTimer,
  isApprovedTimeEntryStatus,
  isLockedTimeEntryStatus,
  isPausedTimer,
  minutesBetween,
  nextAllowedTimeEntryStatuses,
  normalizePauseReason,
  timeEntryStatusOrder,
} from "@/lib/shop/time";
import {
  validateChangeOrderNumber,
  validateEstimateNumber,
  validateInspectionParent,
  validateNonNegativeMinutes,
  validateNonNegativeQuantity,
  validatePositiveQuantity,
  validateWorkOrderNumber,
} from "@/lib/shop/validators";

function assertValidationError(callback: () => unknown, messageIncludes: string) {
  assert.throws(callback, (error) => {
    assert.ok(error instanceof ValidationError);
    assert.match(error.message, new RegExp(messageIncludes));
    return true;
  });
}

function assertError(callback: () => unknown, messageIncludes: string) {
  assert.throws(callback, (error) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, new RegExp(messageIncludes));
    return true;
  });
}

assert.equal(workOrderStatusOrder(WorkOrderStatus.OPEN), 0);
assert.equal(workOrderStatusOrder(WorkOrderStatus.CLOSED), 6);
assert.equal(workOrderStatusOrder("BAD"), -1);
assert.equal(isActiveWorkOrderStatus(WorkOrderStatus.QC), true);
assert.equal(isClosedWorkOrderStatus(WorkOrderStatus.CLOSED), true);
assert.equal(isHoldWorkOrderStatus(WorkOrderStatus.ON_HOLD_PARTS), true);
assert.deepEqual(nextAllowedWorkOrderStatuses(WorkOrderStatus.OPEN), [
  WorkOrderStatus.IN_PROGRESS,
  WorkOrderStatus.ON_HOLD_PARTS,
  WorkOrderStatus.ON_HOLD_DELAY,
]);
assert.equal(canTransitionWorkOrder(WorkOrderStatus.OPEN, WorkOrderStatus.IN_PROGRESS), true);
assert.equal(canTransitionWorkOrder(WorkOrderStatus.OPEN, WorkOrderStatus.CLOSED), false);
assert.equal(canTransitionWorkOrder(WorkOrderStatus.READY_TO_BILL, WorkOrderStatus.CLOSED), true);
assert.equal(canTransitionWorkOrder(WorkOrderStatus.CLOSED, WorkOrderStatus.IN_PROGRESS), false);

assert.equal(timeEntryStatusOrder(TimeEntryStatus.DRAFT), 0);
assert.equal(timeEntryStatusOrder(TimeEntryStatus.REJECTED), 2);
assert.equal(isApprovedTimeEntryStatus(TimeEntryStatus.APPROVED), true);
assert.equal(isApprovedTimeEntryStatus(TimeEntryStatus.LOCKED), true);
assert.equal(isLockedTimeEntryStatus(TimeEntryStatus.LOCKED), true);
assert.deepEqual(nextAllowedTimeEntryStatuses(TimeEntryStatus.SUBMITTED), [
  TimeEntryStatus.APPROVED,
  TimeEntryStatus.REJECTED,
]);
assert.equal(canTransitionTimeEntryStatus(TimeEntryStatus.DRAFT, TimeEntryStatus.SUBMITTED), true);
assert.equal(canTransitionTimeEntryStatus(TimeEntryStatus.APPROVED, TimeEntryStatus.REJECTED), false);
assert.equal(canTransitionTimeEntryStatus(TimeEntryStatus.REJECTED, TimeEntryStatus.DRAFT), true);

const activeTimer = {
  active: true,
  startedAt: new Date("2026-04-20T13:00:00.000Z"),
  endedAt: null,
  pauseReason: null,
};
assert.equal(isActiveTimer(activeTimer), true);
assert.equal(canPauseTimer(activeTimer), true);
assert.equal(canResumeTimer(activeTimer), false);
assert.equal(canStopTimer(activeTimer), true);

const pausedTimer = { ...activeTimer, pauseReason: TimePauseReason.WAITING_PARTS };
assert.equal(isPausedTimer(pausedTimer), true);
assert.equal(canPauseTimer(pausedTimer), false);
assert.equal(canResumeTimer(pausedTimer), true);

assert.equal(minutesBetween(new Date("2026-04-20T13:00:00.000Z"), new Date("2026-04-20T13:45:30.000Z")), 45);
assert.equal(minutesBetween(new Date("2026-04-20T13:45:00.000Z"), new Date("2026-04-20T13:00:00.000Z")), 0);
assert.equal(normalizePauseReason(" waiting_customer "), TimePauseReason.WAITING_CUSTOMER);
assert.equal(normalizePauseReason("not-real"), null);

const stockedPart = {
  quantityOnHand: "10",
  quantityReserved: "3.5",
  reorderPoint: "6.5",
};
assert.equal(availableQuantity(stockedPart), 6.5);
assert.equal(isLowStock(stockedPart), true);
assert.equal(canReserveQuantity(stockedPart, 6.5), true);
assert.equal(canReserveQuantity(stockedPart, 6.51), false);
assert.deepEqual(reserveQuantity(stockedPart, 2), {
  quantityOnHand: 10,
  quantityReserved: 5.5,
});
assert.deepEqual(releaseReservedQuantity(stockedPart, 1.5), {
  quantityOnHand: 10,
  quantityReserved: 2,
});
assert.deepEqual(issueReservedQuantity(stockedPart, 2.5), {
  quantityOnHand: 7.5,
  quantityReserved: 1,
});
assert.deepEqual(receiveQuantity(stockedPart, 4), {
  quantityOnHand: 14,
  quantityReserved: 3.5,
});
assert.deepEqual(adjustQuantityOnHand(stockedPart, -2), {
  quantityOnHand: 8,
  quantityReserved: 3.5,
});
assert.equal(transactionAffectsOnHand(PartTransactionType.RECEIVE), true);
assert.equal(transactionAffectsOnHand(PartTransactionType.RESERVE), false);
assertError(() => reserveQuantity(stockedPart, 7), "available stock");
assertError(() => issueReservedQuantity(stockedPart, 4), "reserved stock");
assertError(() => adjustQuantityOnHand(stockedPart, -8), "reserved stock");

const date = new Date("2026-04-20T12:00:00.000Z");
assert.equal(buildShopNumber("WO", date, 1), "WO-202604-0001");
assert.equal(buildShopNumber("EST", date, 42), "EST-202604-0042");
assert.equal(buildShopNumber("CO", date, 9999), "CO-202604-9999");
assert.equal(extractShopNumberSequence("WO-202604-0042"), 42);
assert.equal(extractShopNumberSequence("bad"), null);
assertError(() => buildShopNumber("WO", date, 0), "sequence");

assert.equal(validateWorkOrderNumber(" wo-202604-0001 "), "WO-202604-0001");
assert.equal(validateEstimateNumber("EST-202604-0001"), "EST-202604-0001");
assert.equal(validateChangeOrderNumber("co-202604-0002"), "CO-202604-0002");
assert.equal(validateWorkOrderNumber(null), null);
assertValidationError(() => validateWorkOrderNumber("BAD"), "WO-YYYYMM");
assertValidationError(() => validateEstimateNumber("WO-202604-0001"), "EST-YYYYMM");
assertValidationError(() => validateChangeOrderNumber("CO-202604-ABC"), "CO-YYYYMM");

assert.equal(validatePositiveQuantity("2.5"), 2.5);
assert.equal(validateNonNegativeQuantity(0), 0);
assert.equal(validateNonNegativeMinutes(15), 15);
assertValidationError(() => validatePositiveQuantity(0), "greater than zero");
assertValidationError(() => validateNonNegativeQuantity(-1), "zero or greater");
assertValidationError(() => validateNonNegativeMinutes(1.5), "whole number");

assert.deepEqual(validateInspectionParent({
  customerId: " cust_1 ",
  vehicleId: "veh_1",
  workOrderId: "",
}), {
  customerId: "cust_1",
  vehicleId: "veh_1",
  workOrderId: null,
});
assertValidationError(
  () => validateInspectionParent({ customerId: "cust_1", vehicleId: "" }),
  "vehicleId",
);

assert.equal(canWriteWorkOrders(Role.SERVICE_WRITER), true);
assert.equal(canWriteWorkOrders(Role.TECH), false);
assert.equal(canWriteTimeEntries(Role.TECH), true);
assert.equal(canApproveTimeEntries(Role.TECH), false);
assert.equal(canApproveTimeEntries(Role.SERVICE_MANAGER), true);
assert.equal(canWritePartsInventory(Role.PARTS), true);
assert.equal(canWritePartsInventory(Role.SALES_REP), false);
assert.equal(canWriteEstimates(Role.SERVICE_WRITER), true);
assert.equal(canWriteInspections(Role.INSPECTOR), true);
assert.equal(canWriteWarrantyClaims(Role.SERVICE_MANAGER), true);
assert.equal(canWriteWarrantyClaims(Role.SERVICE_WRITER), false);

console.log("Shop helpers test: OK");
