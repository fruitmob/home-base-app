import {
  TimeEntryStatus,
  TimePauseReason,
  type TimeEntryStatus as TimeEntryStatusValue,
  type TimePauseReason as TimePauseReasonValue,
} from "@/generated/prisma/client";

export const TIME_ENTRY_STATUS_ORDER: readonly TimeEntryStatusValue[] = [
  TimeEntryStatus.DRAFT,
  TimeEntryStatus.SUBMITTED,
  TimeEntryStatus.REJECTED,
  TimeEntryStatus.APPROVED,
  TimeEntryStatus.LOCKED,
] as const;

const ALLOWED_TIME_ENTRY_TRANSITIONS: Record<TimeEntryStatusValue, readonly TimeEntryStatusValue[]> = {
  [TimeEntryStatus.DRAFT]: [TimeEntryStatus.SUBMITTED],
  [TimeEntryStatus.SUBMITTED]: [TimeEntryStatus.APPROVED, TimeEntryStatus.REJECTED],
  [TimeEntryStatus.APPROVED]: [TimeEntryStatus.LOCKED],
  [TimeEntryStatus.REJECTED]: [TimeEntryStatus.DRAFT, TimeEntryStatus.SUBMITTED],
  [TimeEntryStatus.LOCKED]: [],
};

export type TimerLike = {
  active: boolean;
  startedAt: Date | string | null;
  endedAt: Date | string | null;
  pauseReason?: TimePauseReasonValue | null;
  deletedAt?: Date | string | null;
};

export function timeEntryStatusOrder(status: string): number {
  return TIME_ENTRY_STATUS_ORDER.indexOf(status as TimeEntryStatusValue);
}

export function isLockedTimeEntryStatus(status: string): boolean {
  return status === TimeEntryStatus.LOCKED;
}

export function isApprovedTimeEntryStatus(status: string): boolean {
  return status === TimeEntryStatus.APPROVED || status === TimeEntryStatus.LOCKED;
}

export function nextAllowedTimeEntryStatuses(current: TimeEntryStatusValue): TimeEntryStatusValue[] {
  return [...ALLOWED_TIME_ENTRY_TRANSITIONS[current]];
}

export function canTransitionTimeEntryStatus(
  current: TimeEntryStatusValue,
  next: TimeEntryStatusValue,
): boolean {
  if (current === next) {
    return false;
  }

  return ALLOWED_TIME_ENTRY_TRANSITIONS[current].includes(next);
}

export function isActiveTimer(entry: TimerLike): boolean {
  return entry.active && Boolean(entry.startedAt) && !entry.endedAt && !entry.deletedAt;
}

export function isPausedTimer(entry: TimerLike): boolean {
  return isActiveTimer(entry) && Boolean(entry.pauseReason);
}

export function canPauseTimer(entry: TimerLike): boolean {
  return isActiveTimer(entry) && !isPausedTimer(entry);
}

export function canResumeTimer(entry: TimerLike): boolean {
  return isPausedTimer(entry);
}

export function canStopTimer(entry: TimerLike): boolean {
  return isActiveTimer(entry);
}

export function minutesBetween(start: Date, end: Date): number {
  const diffMs = end.getTime() - start.getTime();

  return Math.max(0, Math.floor(diffMs / 60000));
}

export function normalizePauseReason(reason: string | null | undefined): TimePauseReasonValue | null {
  if (!reason) {
    return null;
  }

  const normalized = reason.trim().toUpperCase();
  const allowed = Object.values(TimePauseReason);

  return allowed.includes(normalized as TimePauseReasonValue)
    ? (normalized as TimePauseReasonValue)
    : null;
}
