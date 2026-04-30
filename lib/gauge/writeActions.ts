import type { CurrentUser } from "@/lib/auth";
import { createGaugeActionEnvelope } from "@/lib/gauge/actions";
import type { GaugeDraftArtifact } from "@/lib/gauge/drafts";
import { trimSentence } from "@/lib/gauge/tools/draftContext";
import {
  assertCustomerEntityWriteRole,
  assertEstimateWriteRole,
  assertWorkOrderWriteRole,
} from "@/lib/core/api";
import { ValidationError } from "@/lib/core/validators";
import { createVehicleNote } from "@/lib/core/vehicleNotes";
import { findActiveWorkOrder } from "@/lib/shop/workOrders";
import { createDraftEstimate, normalizeEstimateLineItems } from "@/lib/shop/estimates";
import {
  createDraftChangeOrder,
  normalizeChangeOrderLineItems,
} from "@/lib/shop/changeOrders";

export type GaugeWriteToolName =
  | "create_estimate_draft_from_draft"
  | "create_change_order_draft_from_draft"
  | "save_vehicle_note_from_draft";

type GaugeWriteResult = {
  output: Record<string, unknown>;
  assistantContent: string;
};

type PreparedWriteAction = {
  toolName: GaugeWriteToolName;
  input: Record<string, unknown>;
  assistantLeadIn: string;
};

type WriteToolHandler = {
  prepare(input: Record<string, unknown>, user: CurrentUser): Promise<GaugeWriteResult>;
  confirm(
    input: Record<string, unknown>,
    user: CurrentUser,
    request?: Request,
  ): Promise<GaugeWriteResult>;
};

const writeToolHandlers: Record<GaugeWriteToolName, WriteToolHandler> = {
  create_estimate_draft_from_draft: {
    async prepare(input, user) {
      assertEstimateWriteRole(user);
      const workOrderId = requiredString(input.workOrderId, "workOrderId");
      const workOrder = await findActiveWorkOrder(workOrderId);
      const lineItems = normalizeEstimateLineItems(readLineItems(input.lineItems));
      const title = `Create draft estimate for ${workOrder.workOrderNumber}`;

      return {
        output: {
          message: `I prepared a draft estimate write for ${workOrder.workOrderNumber}. Confirm it to create the estimate.`,
          ...createGaugeActionEnvelope([
            {
              kind: "create_estimate_draft",
              status: "pending_confirmation",
              title,
              summary: `${lineItems.length} suggested lines will be added to a new draft estimate for ${workOrder.customer.displayName}.`,
              confirmationLabel: "Confirm Estimate",
              relatedHref: `/work-orders/${workOrder.id}`,
              relatedLabel: workOrder.workOrderNumber,
              body: requiredString(input.body, "body"),
              reviewItems: [
                { label: "Customer", value: workOrder.customer.displayName },
                {
                  label: "Vehicle",
                  value: workOrder.vehicle
                    ? [workOrder.vehicle.year, workOrder.vehicle.make, workOrder.vehicle.model]
                        .filter(Boolean)
                        .join(" ")
                    : "No vehicle linked",
                },
                { label: "Work order", value: workOrder.workOrderNumber },
                { label: "Estimate title", value: buildEstimateTitle(workOrder.workOrderNumber, workOrder.title) },
              ],
              lineItems: lineItems.map(toDraftLineItem),
              metadata: {
                workOrderId: workOrder.id,
                customerId: workOrder.customerId,
                vehicleId: workOrder.vehicleId,
              },
            },
          ]),
        },
        assistantContent: `I prepared a draft estimate write for ${workOrder.workOrderNumber}. Review it and confirm when you're ready.`,
      };
    },
    async confirm(input, user, request) {
      assertEstimateWriteRole(user);
      const workOrderId = requiredString(input.workOrderId, "workOrderId");
      const workOrder = await findActiveWorkOrder(workOrderId);
      const lineItems = normalizeEstimateLineItems(readLineItems(input.lineItems));
      const estimate = await createDraftEstimate({
        userId: user.id,
        request,
        customerId: workOrder.customerId,
        vehicleId: workOrder.vehicleId,
        opportunityId: workOrder.opportunityId,
        quoteId: workOrder.quoteId,
        title: buildEstimateTitle(workOrder.workOrderNumber, workOrder.title),
        notes: requiredString(input.body, "body"),
        lineItems,
      });

      return {
        output: {
          message: `Draft estimate ${estimate.estimateNumber} is ready.`,
          ...createGaugeActionEnvelope([
            {
              kind: "create_estimate_draft",
              status: "completed",
              title: `Draft estimate ${estimate.estimateNumber} created`,
              summary: `${estimate.estimateNumber} was created for ${estimate.customer.displayName}.`,
              confirmationLabel: "Confirmed",
              relatedHref: `/work-orders/${workOrder.id}`,
              relatedLabel: workOrder.workOrderNumber,
              resultHref: `/estimates/${estimate.id}`,
              resultLabel: estimate.estimateNumber,
              body: requiredString(input.body, "body"),
              reviewItems: [
                { label: "Customer", value: estimate.customer.displayName },
                { label: "Estimate", value: estimate.estimateNumber },
                { label: "Status", value: estimate.status },
              ],
              lineItems: lineItems.map(toDraftLineItem),
              metadata: {
                estimateId: estimate.id,
                workOrderId: workOrder.id,
              },
            },
          ]),
        },
        assistantContent: `Draft estimate ${estimate.estimateNumber} is ready and saved in Home Base.`,
      };
    },
  },
  create_change_order_draft_from_draft: {
    async prepare(input, user) {
      assertWorkOrderWriteRole(user);
      const workOrderId = requiredString(input.workOrderId, "workOrderId");
      const workOrder = await findActiveWorkOrder(workOrderId);
      const lineItems = normalizeChangeOrderLineItems(readLineItems(input.lineItems));
      const title = `Create draft change order for ${workOrder.workOrderNumber}`;

      return {
        output: {
          message: `I prepared a draft change-order write for ${workOrder.workOrderNumber}. Confirm it to create the change order.`,
          ...createGaugeActionEnvelope([
            {
              kind: "create_change_order_draft",
              status: "pending_confirmation",
              title,
              summary: `${lineItems.length} suggested lines will be added to a new draft change order.`,
              confirmationLabel: "Confirm Change Order",
              relatedHref: `/work-orders/${workOrder.id}`,
              relatedLabel: workOrder.workOrderNumber,
              body: requiredString(input.body, "body"),
              reviewItems: [
                { label: "Customer", value: workOrder.customer.displayName },
                { label: "Work order", value: workOrder.workOrderNumber },
                {
                  label: "Change-order title",
                  value: buildChangeOrderTitle(workOrder.workOrderNumber, workOrder.title),
                },
              ],
              lineItems: lineItems.map(toDraftLineItem),
              metadata: {
                workOrderId: workOrder.id,
              },
            },
          ]),
        },
        assistantContent: `I prepared a draft change-order write for ${workOrder.workOrderNumber}. Review it and confirm when you're ready.`,
      };
    },
    async confirm(input, user, request) {
      assertWorkOrderWriteRole(user);
      const workOrderId = requiredString(input.workOrderId, "workOrderId");
      const workOrder = await findActiveWorkOrder(workOrderId);
      const lineItems = normalizeChangeOrderLineItems(readLineItems(input.lineItems));
      const changeOrder = await createDraftChangeOrder({
        userId: user.id,
        request,
        workOrderId: workOrder.id,
        title: buildChangeOrderTitle(workOrder.workOrderNumber, workOrder.title),
        reason: trimSentence(requiredString(input.body, "body")),
        lineItems,
      });

      return {
        output: {
          message: `Draft change order ${changeOrder.changeOrderNumber} is ready.`,
          ...createGaugeActionEnvelope([
            {
              kind: "create_change_order_draft",
              status: "completed",
              title: `Draft change order ${changeOrder.changeOrderNumber} created`,
              summary: `${changeOrder.changeOrderNumber} was created for ${workOrder.workOrderNumber}.`,
              confirmationLabel: "Confirmed",
              relatedHref: `/work-orders/${workOrder.id}`,
              relatedLabel: workOrder.workOrderNumber,
              resultHref: `/change-orders/${changeOrder.id}`,
              resultLabel: changeOrder.changeOrderNumber,
              body: requiredString(input.body, "body"),
              reviewItems: [
                { label: "Work order", value: workOrder.workOrderNumber },
                { label: "Change order", value: changeOrder.changeOrderNumber },
                { label: "Status", value: changeOrder.status },
              ],
              lineItems: lineItems.map(toDraftLineItem),
              metadata: {
                changeOrderId: changeOrder.id,
                workOrderId: workOrder.id,
              },
            },
          ]),
        },
        assistantContent: `Draft change order ${changeOrder.changeOrderNumber} is ready and saved in Home Base.`,
      };
    },
  },
  save_vehicle_note_from_draft: {
    async prepare(input, user) {
      assertCustomerEntityWriteRole(user);
      const vehicleId = requiredString(input.vehicleId, "vehicleId");
      const title = requiredString(input.title, "title");
      const relatedHref = optionalString(input.relatedHref);
      const relatedLabel = optionalString(input.relatedLabel);

      return {
        output: {
          message: `I prepared that internal note for saving. Confirm it to create the vehicle note.`,
          ...createGaugeActionEnvelope([
            {
              kind: "save_vehicle_note",
              status: "pending_confirmation",
              title: `Save note: ${title}`,
              summary: "This will save the reviewed draft as a vehicle note.",
              confirmationLabel: "Confirm Note",
              relatedHref,
              relatedLabel,
              body: requiredString(input.body, "body"),
              reviewItems: [
                { label: "Vehicle", value: relatedLabel ?? vehicleId },
                { label: "Note type", value: "GENERAL" },
              ],
              metadata: {
                vehicleId,
              },
            },
          ]),
        },
        assistantContent: "I prepared that internal note for saving. Review it and confirm when you're ready.",
      };
    },
    async confirm(input, user, request) {
      assertCustomerEntityWriteRole(user);
      const vehicleId = requiredString(input.vehicleId, "vehicleId");
      const note = await createVehicleNote({
        vehicleId,
        userId: user.id,
        body: requiredString(input.body, "body"),
        request,
      });
      const relatedHref = optionalString(input.relatedHref);
      const relatedLabel = optionalString(input.relatedLabel);

      return {
        output: {
          message: "The vehicle note is saved.",
          ...createGaugeActionEnvelope([
            {
              kind: "save_vehicle_note",
              status: "completed",
              title: "Vehicle note saved",
              summary: "The internal note was saved to the vehicle record.",
              confirmationLabel: "Confirmed",
              relatedHref,
              relatedLabel,
              resultHref: relatedHref,
              resultLabel: relatedLabel,
              body: note.body,
              reviewItems: [
                { label: "Vehicle", value: relatedLabel ?? vehicleId },
                { label: "Note id", value: note.id },
              ],
              metadata: {
                vehicleNoteId: note.id,
                vehicleId,
              },
            },
          ]),
        },
        assistantContent: "That internal note is now saved on the vehicle record.",
      };
    },
  },
};

export async function prepareGaugeWriteFromDraft(draft: GaugeDraftArtifact, user: CurrentUser) {
  const prepared = buildPreparedWriteAction(draft);
  const result = await writeToolHandlers[prepared.toolName].prepare(prepared.input, user);

  return {
    toolName: prepared.toolName,
    input: prepared.input,
    assistantLeadIn: prepared.assistantLeadIn,
    ...result,
  };
}

export async function confirmGaugeWriteTool(
  toolName: GaugeWriteToolName,
  input: Record<string, unknown>,
  user: CurrentUser,
  request?: Request,
) {
  return writeToolHandlers[toolName].confirm(input, user, request);
}

export function isGaugeWriteToolName(value: string): value is GaugeWriteToolName {
  return value in writeToolHandlers;
}

export function summarizeGaugeWriteOutput(output: unknown) {
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    return "I could not summarize that write action.";
  }

  const record = output as Record<string, unknown>;
  return typeof record.message === "string" && record.message.trim()
    ? record.message.trim()
    : "I prepared that write action.";
}

function buildPreparedWriteAction(draft: GaugeDraftArtifact): PreparedWriteAction {
  const workOrderId = readMetadataString(draft, "workOrderId");
  const vehicleId = readMetadataString(draft, "vehicleId");

  if (draft.kind === "estimate_suggestions" && workOrderId) {
    return {
      toolName: "create_estimate_draft_from_draft",
      assistantLeadIn: "I'll prepare that draft estimate for confirmation.",
      input: {
        workOrderId,
        title: draft.title,
        body: draft.body,
        lineItems: draft.lineItems ?? [],
      },
    };
  }

  if (draft.kind === "change_order_suggestions" && workOrderId) {
    return {
      toolName: "create_change_order_draft_from_draft",
      assistantLeadIn: "I'll prepare that draft change order for confirmation.",
      input: {
        workOrderId,
        title: draft.title,
        body: draft.body,
        lineItems: draft.lineItems ?? [],
      },
    };
  }

  if (draft.kind === "internal_note" && vehicleId) {
    return {
      toolName: "save_vehicle_note_from_draft",
      assistantLeadIn: "I'll prepare that internal note for confirmation.",
      input: {
        vehicleId,
        title: draft.title,
        body: draft.body,
        relatedHref: draft.relatedHref ?? null,
        relatedLabel: draft.relatedLabel ?? null,
      },
    };
  }

  throw new ValidationError(["That draft is not eligible for a confirmed write yet."]);
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new ValidationError([`${field} is required for that write action.`]);
  }

  return value.trim();
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readMetadataString(draft: GaugeDraftArtifact, key: string) {
  const value = draft.metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readLineItems(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function buildEstimateTitle(workOrderNumber: string, workOrderTitle: string | null) {
  return trimSentence(workOrderTitle)
    ? `Estimate for ${workOrderNumber}: ${trimSentence(workOrderTitle)}`
    : `Estimate for ${workOrderNumber}`;
}

function buildChangeOrderTitle(workOrderNumber: string, workOrderTitle: string | null) {
  return trimSentence(workOrderTitle)
    ? `Additional work for ${workOrderNumber}: ${trimSentence(workOrderTitle)}`
    : `Additional work for ${workOrderNumber}`;
}

function toDraftLineItem(lineItem: {
  lineType: string;
  description: string;
  quantity: number;
  unitPrice: number | null;
  taxable: boolean;
}) {
  return {
    lineType: lineItem.lineType,
    description: lineItem.description,
    quantity: lineItem.quantity,
    unitPrice: lineItem.unitPrice,
    taxable: lineItem.taxable,
  };
}

export function canPrepareWriteFromDraft(draft: GaugeDraftArtifact) {
  try {
    buildPreparedWriteAction(draft);
    return true;
  } catch {
    return false;
  }
}

export function getWriteActionLabel(draft: GaugeDraftArtifact) {
  if (draft.kind === "estimate_suggestions") {
    return "Prepare Estimate";
  }

  if (draft.kind === "change_order_suggestions") {
    return "Prepare Change Order";
  }

  if (draft.kind === "internal_note") {
    return "Prepare Note";
  }

  return "Prepare Write";
}
