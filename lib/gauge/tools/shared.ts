export function readToolQuery(input: Record<string, unknown>) {
  return typeof input.query === "string" ? input.query.trim().slice(0, 120) : "";
}

export function readToolLimit(input: Record<string, unknown>, defaultLimit = 5, max = 8) {
  const raw = input.limit;
  const limit = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : defaultLimit;

  if (!Number.isFinite(limit)) {
    return defaultLimit;
  }

  return Math.max(1, Math.min(Math.floor(limit), max));
}

export function noMatchesResult(query: string, label: string) {
  return {
    found: false,
    query,
    message: `No ${label} matched "${query}".`,
  };
}

export function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function asRecordArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is Record<string, unknown> =>
          !!entry && typeof entry === "object" && !Array.isArray(entry),
      )
    : [];
}

export function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function asBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}
