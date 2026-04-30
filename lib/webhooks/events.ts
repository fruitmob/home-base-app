export const WEBHOOK_EVENT_CATALOG = [
  {
    type: "work_order.status_changed",
    label: "Work order status changed",
    description: "Emitted when a work order moves between statuses.",
  },
  {
    type: "estimate.approved",
    label: "Estimate approved",
    description: "Emitted when an estimate is approved, whether from the portal or by staff.",
  },
  {
    type: "portal.upload_received",
    label: "Portal upload received",
    description: "Emitted when a customer uploads a photo or document through the portal.",
  },
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_CATALOG)[number]["type"];

const EVENT_TYPE_SET = new Set<string>(WEBHOOK_EVENT_CATALOG.map((entry) => entry.type));

export function isWebhookEventType(value: string): value is WebhookEventType {
  return EVENT_TYPE_SET.has(value);
}
