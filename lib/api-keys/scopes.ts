export const API_KEY_SCOPE_CATALOG = [
  {
    scope: "customers.read",
    label: "Read customers",
    description: "List and fetch customer records and basic contact metadata.",
  },
  {
    scope: "vehicles.read",
    label: "Read vehicles",
    description: "List and fetch vehicle records, including VIN and odometer history.",
  },
  {
    scope: "work-orders.read",
    label: "Read work orders",
    description: "List and fetch work orders, including status and line-item totals.",
  },
  {
    scope: "estimates.read",
    label: "Read estimates",
    description: "List and fetch estimates, including approval status and totals.",
  },
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPE_CATALOG)[number]["scope"];

const SCOPE_SET = new Set<string>(API_KEY_SCOPE_CATALOG.map((entry) => entry.scope));

export function isApiKeyScope(value: string): value is ApiKeyScope {
  return SCOPE_SET.has(value);
}

export function sanitizeScopes(input: readonly string[]): ApiKeyScope[] {
  const seen = new Set<ApiKeyScope>();
  for (const entry of input) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (isApiKeyScope(trimmed)) {
      seen.add(trimmed);
    }
  }
  return Array.from(seen);
}
