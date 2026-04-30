import { randomUUID } from "node:crypto";
import { Prisma, WebhookDeliveryStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { isWebhookEventType, type WebhookEventType } from "@/lib/webhooks/events";
import {
  WEBHOOK_EVENT_ID_HEADER,
  WEBHOOK_EVENT_TYPE_HEADER,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
  signWebhookPayload,
} from "@/lib/webhooks/signing";

const DEFAULT_MAX_ATTEMPTS = 6;
const REQUEST_TIMEOUT_MS = 10_000;
const RESPONSE_BODY_LIMIT = 2_048;

const BACKOFF_MINUTES = [1, 5, 30, 120, 720, 1440];

export type WebhookPayloadObject = { [key: string]: WebhookPayloadValue };
export type WebhookPayloadValue =
  | string
  | number
  | boolean
  | null
  | WebhookPayloadObject
  | readonly WebhookPayloadValue[];

export type EmitWebhookInput = {
  eventType: WebhookEventType;
  eventId?: string;
  payload: WebhookPayloadObject;
};

export type EmitWebhookResult = {
  eventId: string;
  queued: number;
};

export async function emitWebhook(input: EmitWebhookInput): Promise<EmitWebhookResult> {
  if (!isWebhookEventType(input.eventType)) {
    throw new Error(`Unknown webhook event type: ${input.eventType}`);
  }

  const eventId = input.eventId ?? randomUUID();
  const endpoints = await db.webhookEndpoint.findMany({
    where: { deletedAt: null, enabled: true },
  });

  const matching = endpoints.filter((endpoint) => {
    const allowed = readEventTypes(endpoint.eventTypesJson);
    return allowed.includes(input.eventType);
  });

  if (matching.length === 0) {
    return { eventId, queued: 0 };
  }

  const payloadJson = input.payload as Prisma.InputJsonValue;
  const now = new Date();

  await db.webhookDelivery.createMany({
    data: matching.map((endpoint) => ({
      endpointId: endpoint.id,
      eventType: input.eventType,
      eventId,
      payloadJson,
      status: WebhookDeliveryStatus.PENDING,
      attemptCount: 0,
      maxAttempts: DEFAULT_MAX_ATTEMPTS,
      nextAttemptAt: now,
    })),
  });

  return { eventId, queued: matching.length };
}

export type DeliveryResult = {
  deliveryId: string;
  status: WebhookDeliveryStatus;
  responseStatus?: number;
  errorMessage?: string;
};

export async function processPendingDeliveries(limit = 25): Promise<DeliveryResult[]> {
  const now = new Date();

  const ready = await db.webhookDelivery.findMany({
    where: {
      status: WebhookDeliveryStatus.PENDING,
      nextAttemptAt: { lte: now },
      endpoint: { deletedAt: null, enabled: true },
    },
    include: { endpoint: true },
    orderBy: [{ nextAttemptAt: "asc" }],
    take: limit,
  });

  const results: DeliveryResult[] = [];
  for (const delivery of ready) {
    const result = await attemptDelivery(delivery);
    results.push(result);
  }
  return results;
}

type DeliveryRow = Prisma.WebhookDeliveryGetPayload<{ include: { endpoint: true } }>;

async function attemptDelivery(delivery: DeliveryRow): Promise<DeliveryResult> {
  const timestamp = new Date().toISOString();
  const rawBody = JSON.stringify(delivery.payloadJson);
  const signature = signWebhookPayload(delivery.endpoint.secret, timestamp, rawBody);

  const headers: Record<string, string> = {
    "content-type": "application/json",
    [WEBHOOK_TIMESTAMP_HEADER]: timestamp,
    [WEBHOOK_SIGNATURE_HEADER]: signature,
    [WEBHOOK_EVENT_TYPE_HEADER]: delivery.eventType,
    [WEBHOOK_EVENT_ID_HEADER]: delivery.eventId,
    "user-agent": "HomeBase-Webhooks/1.0",
  };

  const attemptNumber = delivery.attemptCount + 1;
  const attemptedAt = new Date();

  try {
    const response = await fetchWithTimeout(delivery.endpoint.url, {
      method: "POST",
      headers,
      body: rawBody,
    });
    const bodyText = await readResponseBody(response);

    if (response.ok) {
      await db.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: WebhookDeliveryStatus.SUCCEEDED,
          attemptCount: attemptNumber,
          lastAttemptAt: attemptedAt,
          responseStatus: response.status,
          responseBody: bodyText,
          errorMessage: null,
        },
      });
      return {
        deliveryId: delivery.id,
        status: WebhookDeliveryStatus.SUCCEEDED,
        responseStatus: response.status,
      };
    }

    return await recordFailure(delivery, attemptNumber, attemptedAt, {
      responseStatus: response.status,
      responseBody: bodyText,
      errorMessage: `Endpoint responded with HTTP ${response.status}`,
    });
  } catch (error) {
    return await recordFailure(delivery, attemptNumber, attemptedAt, {
      errorMessage: stringifyError(error),
    });
  }
}

async function recordFailure(
  delivery: DeliveryRow,
  attemptNumber: number,
  attemptedAt: Date,
  failure: { errorMessage: string; responseStatus?: number; responseBody?: string | null },
): Promise<DeliveryResult> {
  const exhausted = attemptNumber >= delivery.maxAttempts;
  const status = exhausted
    ? WebhookDeliveryStatus.PERMANENTLY_FAILED
    : WebhookDeliveryStatus.PENDING;
  const nextAttemptAt = exhausted
    ? attemptedAt
    : new Date(attemptedAt.getTime() + backoffMs(attemptNumber));

  await db.webhookDelivery.update({
    where: { id: delivery.id },
    data: {
      status,
      attemptCount: attemptNumber,
      lastAttemptAt: attemptedAt,
      nextAttemptAt,
      responseStatus: failure.responseStatus ?? null,
      responseBody: failure.responseBody ?? null,
      errorMessage: failure.errorMessage,
    },
  });

  return {
    deliveryId: delivery.id,
    status,
    responseStatus: failure.responseStatus,
    errorMessage: failure.errorMessage,
  };
}

export function backoffMs(attemptNumber: number): number {
  const index = Math.max(0, Math.min(attemptNumber - 1, BACKOFF_MINUTES.length - 1));
  return BACKOFF_MINUTES[index] * 60_000;
}

function readEventTypes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function readResponseBody(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.length > RESPONSE_BODY_LIMIT ? text.slice(0, RESPONSE_BODY_LIMIT) : text;
  } catch {
    return "";
  }
}

function stringifyError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown delivery error.";
  }
}
