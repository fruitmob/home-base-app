import { db } from "@/lib/db";
import { issueApiKey } from "@/lib/api-keys/authenticate";
import { sanitizeScopes, type ApiKeyScope } from "@/lib/api-keys/scopes";

export type ApiKeySummary = {
  id: string;
  label: string;
  lastFour: string;
  scopes: ApiKeyScope[];
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
};

export type IssueApiKeyInput = {
  label: string;
  scopes: string[];
  createdByUserId?: string;
};

export type IssueApiKeyResult = {
  key: ApiKeySummary;
  plaintext: string;
};

export async function listApiKeysForAdmin(): Promise<ApiKeySummary[]> {
  const rows = await db.apiKey.findMany({
    orderBy: [{ revokedAt: "asc" }, { createdAt: "desc" }],
  });
  return rows.map(toSummary);
}

export async function issueApiKeyForAdmin(input: IssueApiKeyInput): Promise<IssueApiKeyResult> {
  const label = input.label.trim();
  if (!label) {
    throw new Error("Label is required.");
  }
  const scopes = sanitizeScopes(input.scopes);
  if (scopes.length === 0) {
    throw new Error("Select at least one scope.");
  }

  const { plaintext, hashedKey, lastFour } = issueApiKey();

  const record = await db.apiKey.create({
    data: {
      label,
      hashedKey,
      lastFour,
      scopesJson: scopes,
      createdByUserId: input.createdByUserId ?? null,
    },
  });

  return { key: toSummary(record), plaintext };
}

export async function revokeApiKey(id: string): Promise<ApiKeySummary> {
  const existing = await db.apiKey.findUnique({ where: { id } });
  if (!existing) {
    throw new Error("API key not found.");
  }
  if (existing.revokedAt) {
    return toSummary(existing);
  }
  const record = await db.apiKey.update({
    where: { id },
    data: { revokedAt: new Date() },
  });
  return toSummary(record);
}

function toSummary(row: {
  id: string;
  label: string;
  lastFour: string;
  scopesJson: unknown;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}): ApiKeySummary {
  const scopes = Array.isArray(row.scopesJson)
    ? sanitizeScopes(row.scopesJson.filter((e): e is string => typeof e === "string"))
    : [];
  return {
    id: row.id,
    label: row.label,
    lastFour: row.lastFour,
    scopes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastUsedAt: row.lastUsedAt,
    revokedAt: row.revokedAt,
  };
}
