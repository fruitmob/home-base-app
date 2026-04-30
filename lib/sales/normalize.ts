const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function normalizeSku(value: string | null | undefined) {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim().toUpperCase();

  return trimmed.length > 0 ? trimmed : null;
}

export function normalizePeriod(value: string | null | undefined) {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim();

  return PERIOD_PATTERN.test(trimmed) ? trimmed : null;
}

export function stageOrder(stage: string): number {
  const map: Record<string, number> = {
    NEW: 0,
    QUALIFIED: 1,
    PROPOSAL: 2,
    NEGOTIATION: 3,
    WON: 4,
    LOST: 5,
  };

  return map[stage] ?? -1;
}

export function isTerminalStage(stage: string): boolean {
  return stage === "WON" || stage === "LOST";
}

export function nextAllowedStages(current: string): string[] {
  switch (current) {
    case "NEW":
      return ["QUALIFIED", "LOST"];
    case "QUALIFIED":
      return ["PROPOSAL", "LOST"];
    case "PROPOSAL":
      return ["NEGOTIATION", "WON", "LOST"];
    case "NEGOTIATION":
      return ["WON", "LOST"];
    case "WON":
    case "LOST":
      return [];
    default:
      return [];
  }
}

export function stripQuoteNumber(value: string | null | undefined) {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim().toUpperCase();

  return trimmed.length > 0 ? trimmed : null;
}

export function isTerminalLeadStatus(status: string): boolean {
  return status === "CONVERTED" || status === "UNQUALIFIED";
}

export function nextAllowedLeadStatuses(current: string): string[] {
  switch (current) {
    case "NEW":
      return ["WORKING", "QUALIFIED", "UNQUALIFIED"];
    case "WORKING":
      return ["QUALIFIED", "UNQUALIFIED"];
    case "QUALIFIED":
      return ["CONVERTED", "UNQUALIFIED"];
    case "UNQUALIFIED":
    case "CONVERTED":
      return [];
    default:
      return [];
  }
}
