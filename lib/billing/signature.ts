import { createHmac, timingSafeEqual } from "node:crypto";

export const STRIPE_SIGNATURE_HEADER = "stripe-signature";
const DEFAULT_TOLERANCE_SECONDS = 5 * 60;

export function verifyStripeSignature(
  secret: string,
  rawBody: string,
  header: string | null | undefined,
  options: { toleranceSeconds?: number; now?: Date } = {},
): boolean {
  if (!header) return false;

  const parsed = parseStripeSignatureHeader(header);
  if (!parsed) return false;

  const tolerance = options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  const nowSeconds = Math.floor((options.now ?? new Date()).getTime() / 1000);
  const timestampSeconds = Number.parseInt(parsed.t, 10);
  if (!Number.isFinite(timestampSeconds)) return false;
  if (Math.abs(nowSeconds - timestampSeconds) > tolerance) return false;

  const payload = `${parsed.t}.${rawBody}`;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  for (const candidate of parsed.v1) {
    if (safeEqual(candidate, expected)) {
      return true;
    }
  }
  return false;
}

type ParsedStripeSignature = { t: string; v1: string[] };

function parseStripeSignatureHeader(header: string): ParsedStripeSignature | null {
  const parts = header.split(",").map((entry) => entry.trim());
  let timestamp: string | null = null;
  const digests: string[] = [];
  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const key = part.slice(0, idx);
    const value = part.slice(idx + 1);
    if (key === "t") timestamp = value;
    else if (key === "v1") digests.push(value);
  }
  if (!timestamp || digests.length === 0) return null;
  return { t: timestamp, v1: digests };
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
