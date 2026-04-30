import { createHash, randomBytes } from "node:crypto";
import { HttpError } from "@/lib/auth";
import { db } from "@/lib/db";
import { type ApiKeyScope, isApiKeyScope } from "@/lib/api-keys/scopes";

export const API_KEY_PREFIX = "hbk_";
const API_KEY_BODY_BYTES = 32;

export type AuthenticatedApiKey = {
  id: string;
  label: string;
  scopes: ApiKeyScope[];
};

export function issueApiKey(): { plaintext: string; hashedKey: string; lastFour: string } {
  const body = randomBytes(API_KEY_BODY_BYTES).toString("base64url");
  const plaintext = `${API_KEY_PREFIX}${body}`;
  return {
    plaintext,
    hashedKey: hashApiKey(plaintext),
    lastFour: plaintext.slice(-4),
  };
}

export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

export async function authenticateApiKey(request: Request): Promise<AuthenticatedApiKey> {
  const presented = extractApiKey(request);
  if (!presented) {
    throw new HttpError(401, "API key required.");
  }

  const hashed = hashApiKey(presented);
  const record = await db.apiKey.findUnique({ where: { hashedKey: hashed } });

  if (!record || record.revokedAt) {
    throw new HttpError(401, "API key is invalid or has been revoked.");
  }

  const scopes = readScopes(record.scopesJson);

  void db.apiKey
    .update({
      where: { id: record.id },
      data: { lastUsedAt: new Date() },
    })
    .catch((error) => {
      console.error("[api-key] failed to update lastUsedAt", error);
    });

  return {
    id: record.id,
    label: record.label,
    scopes,
  };
}

export function requireScope(key: AuthenticatedApiKey, scope: ApiKeyScope): void {
  if (!key.scopes.includes(scope)) {
    throw new HttpError(403, `API key is missing the "${scope}" scope.`);
  }
}

function extractApiKey(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return null;
  const candidate = match[1].trim();
  if (!candidate.startsWith(API_KEY_PREFIX)) return null;
  return candidate;
}

function readScopes(value: unknown): ApiKeyScope[] {
  if (!Array.isArray(value)) return [];
  const result: ApiKeyScope[] = [];
  for (const entry of value) {
    if (typeof entry === "string" && isApiKeyScope(entry)) {
      result.push(entry);
    }
  }
  return result;
}
