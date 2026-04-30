import { createDraftEnvelope } from "@/lib/gauge/drafts";
import {
  findDraftCase,
  findDraftVehicle,
  findDraftWorkOrder,
  formatVehicleLabel,
  trimSentence,
} from "@/lib/gauge/tools/draftContext";
import { noMatchesResult, readToolQuery } from "@/lib/gauge/tools/shared";

export const draftInternalNoteTool = {
  type: "function" as const,
  function: {
    name: "draft_internal_note",
    description:
      "Draft an internal operational note from work-order, case, or vehicle context without saving it.",
    parameters: {
      type: "object" as const,
      required: ["query"],
      properties: {
        query: {
          type: "string",
          description: "A work order, vehicle, case, or other shop context to summarize into an internal note.",
        },
      },
    },
  },
};

export async function draftInternalNote(input: Record<string, unknown>) {
  const query = readToolQuery(input);

  if (!query) {
    return {
      found: false,
      message: "A shop-context query is required to draft an internal note.",
    };
  }

  const workOrder = await findDraftWorkOrder(query);
  const supportCase = !workOrder ? await findDraftCase(query) : null;
  const vehicle = !workOrder && !supportCase ? await findDraftVehicle(query) : null;

  if (!workOrder && !supportCase && !vehicle) {
    return noMatchesResult(query, "shop records for an internal note");
  }

  const body = workOrder
    ? [
        `Internal note for ${workOrder.workOrderNumber}: ${trimSentence(workOrder.title) ?? "Active work order"}.`,
        trimSentence(workOrder.complaint)
          ? `Customer concern: ${trimSentence(workOrder.complaint)}.`
          : null,
        `Current status: ${workOrder.status}.`,
        workOrder.assignedTech?.email
          ? `Assigned tech: ${workOrder.assignedTech.email}.`
          : "Assigned tech still needs confirmation.",
        trimSentence(workOrder.internalNotes)
          ? `Existing notes: ${trimSentence(workOrder.internalNotes)}.`
          : null,
        "Next action: confirm findings, align pricing/approval, and update the customer once the next checkpoint is complete.",
      ]
        .filter(Boolean)
        .join(" ")
    : supportCase
      ? [
          `Internal case note: ${supportCase.subject}.`,
          trimSentence(supportCase.description)
            ? `Customer concern: ${trimSentence(supportCase.description)}.`
            : null,
          `Status: ${supportCase.status}. Priority: ${supportCase.priority}.`,
          supportCase.assignedUser?.email
            ? `Owner: ${supportCase.assignedUser.email}.`
            : "Owner still needs assignment.",
          "Next action: confirm the follow-up owner, collect the latest shop update, and prepare the customer response.",
        ]
          .filter(Boolean)
          .join(" ")
      : [
          `Internal vehicle note for ${formatVehicleLabel(vehicle!)}.`,
          vehicle!.vehicleNotes[0]?.body
            ? `Recent note: ${trimSentence(vehicle!.vehicleNotes[0].body)}.`
            : null,
          vehicle!.mileageReadings[0]
            ? `Latest mileage reading: ${vehicle!.mileageReadings[0].value}.`
            : null,
          "Next action: review recent work-order history and capture anything the next advisor or technician should know.",
        ]
          .filter(Boolean)
          .join(" ");

  const relatedHref = workOrder
    ? `/work-orders/${workOrder.id}`
    : supportCase
      ? `/cases/${supportCase.id}`
      : `/vehicles/${vehicle!.id}`;
  const relatedLabel = workOrder
    ? workOrder.workOrderNumber
    : supportCase
      ? supportCase.subject
      : formatVehicleLabel(vehicle!);

  return {
    found: true,
    ...createDraftEnvelope([
      {
        kind: "internal_note",
        title: `Internal note draft for ${relatedLabel}`,
        summary: `Draft note from ${relatedLabel}.`,
        body,
        format: "text",
        relatedHref,
        relatedLabel,
        reviewItems: [
          {
            label: "Customer",
            value:
              workOrder?.customer.displayName ??
              supportCase?.customer.displayName ??
              vehicle?.customer.displayName ??
              "No customer linked",
          },
          {
            label: "Vehicle",
            value:
              (workOrder?.vehicle && formatVehicleLabel(workOrder.vehicle)) ??
              (supportCase?.vehicle && formatVehicleLabel(supportCase.vehicle)) ??
              (vehicle && formatVehicleLabel(vehicle)) ??
              "No vehicle linked",
          },
        ],
        metadata: {
          workOrderId: workOrder?.id ?? null,
          caseId: supportCase?.id ?? null,
          vehicleId: workOrder?.vehicle?.id ?? supportCase?.vehicle?.id ?? vehicle?.id ?? null,
        },
      },
    ]),
  };
}
