import { Prisma, SubscriptionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export const HANDLED_STRIPE_EVENT_TYPES = [
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "invoice.payment_failed",
  "invoice.payment_succeeded",
] as const;

export type HandledStripeEventType = (typeof HANDLED_STRIPE_EVENT_TYPES)[number];

const HANDLED_SET = new Set<string>(HANDLED_STRIPE_EVENT_TYPES);

export function isHandledStripeEvent(type: string): type is HandledStripeEventType {
  return HANDLED_SET.has(type);
}

export type IngestResult = {
  action: "created" | "updated" | "ignored" | "duplicate";
  subscriptionId?: string;
  status?: SubscriptionStatus;
};

export type StripeEvent = {
  id: string;
  type: string;
  created?: number;
  data: { object: StripeEventObject };
};

type StripeEventObject = Record<string, unknown>;

export async function ingestStripeEvent(event: StripeEvent): Promise<IngestResult> {
  const existingEvent = await db.billingEvent.findUnique({
    where: { stripeEventId: event.id },
  });
  if (existingEvent) {
    return { action: "duplicate" };
  }

  const created = await db.billingEvent.create({
    data: {
      stripeEventId: event.id,
      eventType: event.type,
      payloadJson: event as unknown as Prisma.InputJsonValue,
    },
  });

  if (!isHandledStripeEvent(event.type)) {
    await db.billingEvent.update({
      where: { id: created.id },
      data: { processedAt: new Date() },
    });
    return { action: "ignored" };
  }

  try {
    const result = await applyEventToSubscription(event);
    await db.billingEvent.update({
      where: { id: created.id },
      data: { processedAt: new Date() },
    });
    return result;
  } catch (error) {
    await db.billingEvent.update({
      where: { id: created.id },
      data: {
        processedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}

async function applyEventToSubscription(event: StripeEvent): Promise<IngestResult> {
  const object = event.data.object;
  const subscription = extractSubscriptionShape(event, object);
  if (!subscription) {
    return { action: "ignored" };
  }

  const latestEventAt = fromStripeTimestamp(event.created) ?? new Date();
  const existing = await db.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (existing && existing.latestEventAt >= latestEventAt) {
    return {
      action: "ignored",
      subscriptionId: existing.id,
      status: existing.status,
    };
  }

  const data = {
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: subscription.customerId,
    status: subscription.status,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    cancelAt: subscription.cancelAt,
    canceledAt: subscription.canceledAt,
    latestEventAt,
    rawJson: object as unknown as Prisma.InputJsonValue,
  };

  if (!existing) {
    const created = await db.subscription.create({ data });
    return { action: "created", subscriptionId: created.id, status: created.status };
  }

  const updated = await db.subscription.update({
    where: { id: existing.id },
    data,
  });
  return { action: "updated", subscriptionId: updated.id, status: updated.status };
}

type NormalizedSubscription = {
  id: string;
  customerId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  cancelAt: Date | null;
  canceledAt: Date | null;
};

function extractSubscriptionShape(
  event: StripeEvent,
  object: StripeEventObject,
): NormalizedSubscription | null {
  if (event.type.startsWith("customer.subscription.")) {
    return normalizeSubscriptionObject(object);
  }
  if (event.type === "invoice.payment_failed") {
    return shapeFromInvoice(object, SubscriptionStatus.PAST_DUE);
  }
  if (event.type === "invoice.payment_succeeded") {
    return shapeFromInvoice(object, SubscriptionStatus.ACTIVE);
  }
  return null;
}

function normalizeSubscriptionObject(object: StripeEventObject): NormalizedSubscription | null {
  const id = readString(object, "id");
  const customerId = readString(object, "customer");
  if (!id || !customerId) return null;

  const rawStatus = readString(object, "status");
  const status = toSubscriptionStatus(rawStatus);

  return {
    id,
    customerId,
    status,
    currentPeriodStart: fromStripeTimestamp(readNumber(object, "current_period_start")),
    currentPeriodEnd: fromStripeTimestamp(readNumber(object, "current_period_end")),
    cancelAtPeriodEnd: readBoolean(object, "cancel_at_period_end"),
    cancelAt: fromStripeTimestamp(readNumber(object, "cancel_at")),
    canceledAt: fromStripeTimestamp(readNumber(object, "canceled_at")),
  };
}

function shapeFromInvoice(
  object: StripeEventObject,
  fallbackStatus: SubscriptionStatus,
): NormalizedSubscription | null {
  const subscriptionId = readString(object, "subscription");
  const customerId = readString(object, "customer");
  if (!subscriptionId || !customerId) return null;

  return {
    id: subscriptionId,
    customerId,
    status: fallbackStatus,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    cancelAt: null,
    canceledAt: null,
  };
}

function readString(object: StripeEventObject, key: string): string | null {
  const value = object[key];
  if (typeof value === "string" && value.trim() !== "") return value;
  if (value && typeof value === "object" && "id" in (value as Record<string, unknown>)) {
    const nested = (value as Record<string, unknown>).id;
    if (typeof nested === "string" && nested.trim() !== "") return nested;
  }
  return null;
}

function readNumber(object: StripeEventObject, key: string): number | null {
  const value = object[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readBoolean(object: StripeEventObject, key: string): boolean {
  return object[key] === true;
}

function fromStripeTimestamp(value: number | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return null;
  return new Date(value * 1000);
}

function toSubscriptionStatus(value: string | null | undefined): SubscriptionStatus {
  switch (value) {
    case "active":
      return SubscriptionStatus.ACTIVE;
    case "trialing":
      return SubscriptionStatus.TRIALING;
    case "past_due":
      return SubscriptionStatus.PAST_DUE;
    case "canceled":
      return SubscriptionStatus.CANCELED;
    case "incomplete":
    case "incomplete_expired":
      return SubscriptionStatus.INCOMPLETE;
    case "unpaid":
      return SubscriptionStatus.UNPAID;
    case "paused":
      return SubscriptionStatus.PAUSED;
    default:
      return SubscriptionStatus.INCOMPLETE;
  }
}

export async function getCurrentSubscription() {
  return db.subscription.findFirst({
    orderBy: [{ latestEventAt: "desc" }],
  });
}

export function subscriptionNeedsAttention(status: SubscriptionStatus): boolean {
  return (
    status === SubscriptionStatus.PAST_DUE ||
    status === SubscriptionStatus.CANCELED ||
    status === SubscriptionStatus.UNPAID ||
    status === SubscriptionStatus.INCOMPLETE
  );
}
