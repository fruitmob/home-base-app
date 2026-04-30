import { db } from "@/lib/db";
import { sendTemplatedEmail } from "@/lib/email/templates";

// Token length before we hex encode it
const TOKEN_BYTES = 32;

// Standard customer portal expiration
const DEFAULT_EXPIRATION_DAYS = 7;

export async function generatePortalToken(
  payload: { customerId?: string; vehicleId?: string },
  expiresInDays: number = DEFAULT_EXPIRATION_DAYS
) {
  // Generate an opaque string token using Node's standard module
  const { randomBytes } = await import("crypto");
  const tokenString = randomBytes(TOKEN_BYTES).toString("hex");

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const tokenRecord = await db.portalToken.create({
    data: {
      token: tokenString,
      customerId: payload.customerId,
      vehicleId: payload.vehicleId,
      expiresAt,
    },
  });

  return tokenRecord;
}

export async function sendPortalLinkToCustomer(customerId: string, baseUrl: string) {
  const customer = await db.customer.findUnique({
    where: { id: customerId },
  });

  if (!customer) {
    throw new Error("Customer not found");
  }

  if (!customer.email) {
    throw new Error("Customer has no email address on file.");
  }

  const tokenRecord = await generatePortalToken({ customerId: customer.id });
  const portalUrl = `${baseUrl.replace(/\/$/, "")}/portal/${tokenRecord.token}`;

  const emailRes = await sendTemplatedEmail({
    templateKey: "portal.magic-link",
    to: customer.email,
    variables: {
      customerName: customer.firstName || customer.displayName,
      portalUrl,
      expirationDays: DEFAULT_EXPIRATION_DAYS,
    },
  });

  return { token: tokenRecord.token, emailRes };
}

export async function verifyPortalToken(tokenString: string) {
  const record = await db.portalToken.findUnique({
    where: { token: tokenString },
  });

  if (!record) {
    return { valid: false, reason: "NOT_FOUND" as const };
  }

  if (record.revokedAt) {
    return { valid: false, reason: "REVOKED" as const, token: record };
  }

  if (new Date() > record.expiresAt) {
    return { valid: false, reason: "EXPIRED" as const, token: record };
  }

  // Update last used at in background
  await db.portalToken.update({
    where: { id: record.id },
    data: { lastUsedAt: new Date() },
  }).catch(err => {
    console.error("[PortalAuth] failed to update lastUsedAt:", err);
  });

  return { valid: true, token: record };
}
