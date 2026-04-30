import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { isWebhookEventType } from "@/lib/webhooks/events";
import { issueWebhookSecret } from "@/lib/webhooks/signing";

export type WebhookEndpointSummary = {
  id: string;
  label: string;
  url: string;
  enabled: boolean;
  eventTypes: string[];
  secretPreview: string;
  createdAt: Date;
  updatedAt: Date;
};

export type WebhookDeliverySummary = {
  id: string;
  endpointId: string;
  endpointLabel: string;
  eventType: string;
  eventId: string;
  status: string;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: Date;
  lastAttemptAt: Date | null;
  responseStatus: number | null;
  errorMessage: string | null;
  createdAt: Date;
};

export type CreateWebhookEndpointInput = {
  label: string;
  url: string;
  eventTypes: string[];
  createdByUserId?: string;
};

export type CreateWebhookEndpointResult = {
  endpoint: WebhookEndpointSummary;
  secret: string;
};

export async function listWebhookEndpointsForAdmin(): Promise<WebhookEndpointSummary[]> {
  const endpoints = await db.webhookEndpoint.findMany({
    where: { deletedAt: null },
    orderBy: [{ enabled: "desc" }, { label: "asc" }],
  });
  return endpoints.map(toSummary);
}

export async function listRecentWebhookDeliveries(take = 25): Promise<WebhookDeliverySummary[]> {
  const rows = await db.webhookDelivery.findMany({
    orderBy: [{ createdAt: "desc" }],
    take,
    include: { endpoint: true },
  });
  return rows.map((row) => ({
    id: row.id,
    endpointId: row.endpointId,
    endpointLabel: row.endpoint.label,
    eventType: row.eventType,
    eventId: row.eventId,
    status: row.status,
    attemptCount: row.attemptCount,
    maxAttempts: row.maxAttempts,
    nextAttemptAt: row.nextAttemptAt,
    lastAttemptAt: row.lastAttemptAt,
    responseStatus: row.responseStatus,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt,
  }));
}

export async function createWebhookEndpoint(
  input: CreateWebhookEndpointInput,
): Promise<CreateWebhookEndpointResult> {
  const label = input.label.trim();
  const url = input.url.trim();
  if (!label) throw new Error("Label is required.");
  if (!isValidHttpsUrl(url)) {
    throw new Error("URL must be a well-formed https:// endpoint.");
  }
  const eventTypes = uniqueValidEventTypes(input.eventTypes);
  if (eventTypes.length === 0) {
    throw new Error("Select at least one event type.");
  }
  const secret = issueWebhookSecret();

  const endpoint = await db.webhookEndpoint.create({
    data: {
      label,
      url,
      secret,
      enabled: true,
      eventTypesJson: eventTypes,
      createdByUserId: input.createdByUserId ?? null,
    },
  });

  return { endpoint: toSummary(endpoint), secret };
}

export type UpdateWebhookEndpointInput = {
  label?: string;
  url?: string;
  enabled?: boolean;
  eventTypes?: string[];
  rotateSecret?: boolean;
};

export type UpdateWebhookEndpointResult = {
  endpoint: WebhookEndpointSummary;
  secret: string | null;
};

export async function updateWebhookEndpoint(
  id: string,
  input: UpdateWebhookEndpointInput,
): Promise<UpdateWebhookEndpointResult> {
  const existing = await db.webhookEndpoint.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    throw new Error("Webhook endpoint not found.");
  }

  const data: Prisma.WebhookEndpointUpdateInput = {};
  let newSecret: string | null = null;

  if (input.label !== undefined) {
    const label = input.label.trim();
    if (!label) throw new Error("Label cannot be blank.");
    data.label = label;
  }
  if (input.url !== undefined) {
    const url = input.url.trim();
    if (!isValidHttpsUrl(url)) {
      throw new Error("URL must be a well-formed https:// endpoint.");
    }
    data.url = url;
  }
  if (input.enabled !== undefined) {
    data.enabled = input.enabled;
  }
  if (input.eventTypes !== undefined) {
    const eventTypes = uniqueValidEventTypes(input.eventTypes);
    if (eventTypes.length === 0) {
      throw new Error("Select at least one event type.");
    }
    data.eventTypesJson = eventTypes as unknown as Prisma.InputJsonValue;
  }
  if (input.rotateSecret) {
    newSecret = issueWebhookSecret();
    data.secret = newSecret;
  }

  const endpoint = await db.webhookEndpoint.update({ where: { id }, data });
  return { endpoint: toSummary(endpoint), secret: newSecret };
}

export async function deleteWebhookEndpoint(id: string): Promise<void> {
  await db.webhookEndpoint.update({
    where: { id },
    data: { deletedAt: new Date(), enabled: false },
  });
}

function uniqueValidEventTypes(input: string[]): string[] {
  const seen = new Set<string>();
  for (const entry of input) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (!isWebhookEventType(trimmed)) {
      throw new Error(`Unknown event type: ${trimmed}`);
    }
    seen.add(trimmed);
  }
  return Array.from(seen);
}

function isValidHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function toSummary(endpoint: {
  id: string;
  label: string;
  url: string;
  enabled: boolean;
  eventTypesJson: unknown;
  secret: string;
  createdAt: Date;
  updatedAt: Date;
}): WebhookEndpointSummary {
  return {
    id: endpoint.id,
    label: endpoint.label,
    url: endpoint.url,
    enabled: endpoint.enabled,
    eventTypes: Array.isArray(endpoint.eventTypesJson)
      ? endpoint.eventTypesJson.filter((e): e is string => typeof e === "string")
      : [],
    secretPreview: endpoint.secret.slice(-6),
    createdAt: endpoint.createdAt,
    updatedAt: endpoint.updatedAt,
  };
}
