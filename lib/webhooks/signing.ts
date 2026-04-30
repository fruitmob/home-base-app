import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const WEBHOOK_SIGNATURE_HEADER = "x-homebase-signature";
export const WEBHOOK_TIMESTAMP_HEADER = "x-homebase-timestamp";
export const WEBHOOK_EVENT_TYPE_HEADER = "x-homebase-event";
export const WEBHOOK_EVENT_ID_HEADER = "x-homebase-event-id";

export function issueWebhookSecret(): string {
  return `whsec_${randomBytes(32).toString("base64url")}`;
}

export function signWebhookPayload(
  secret: string,
  timestamp: string,
  rawBody: string,
): string {
  const message = `${timestamp}.${rawBody}`;
  const digest = createHmac("sha256", secret).update(message).digest("base64url");
  return `t=${timestamp},v1=${digest}`;
}

export function verifyWebhookSignature(
  secret: string,
  timestamp: string,
  rawBody: string,
  provided: string | null | undefined,
): boolean {
  if (!provided) return false;
  const parsed = parseSignatureHeader(provided);
  if (!parsed || parsed.t !== timestamp) return false;

  const expectedFull = signWebhookPayload(secret, timestamp, rawBody);
  const expected = parseSignatureHeader(expectedFull);
  if (!expected) return false;

  return safeEqual(parsed.v1, expected.v1);
}

type ParsedSignature = { t: string; v1: string };

function parseSignatureHeader(header: string): ParsedSignature | null {
  const parts = header.split(",").map((p) => p.trim());
  let timestamp: string | null = null;
  let digest: string | null = null;
  for (const part of parts) {
    const [key, value] = part.split("=", 2);
    if (!value) continue;
    if (key === "t") timestamp = value;
    else if (key === "v1") digest = value;
  }
  if (!timestamp || !digest) return null;
  return { t: timestamp, v1: digest };
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
