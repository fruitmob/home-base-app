import { createDraftEnvelope } from "@/lib/gauge/drafts";
import { buildLineDraftBody, buildSuggestedLines } from "@/lib/gauge/tools/draftHelpers";
import {
  findDraftEstimate,
  findDraftWorkOrder,
  formatMoney,
  formatVehicleLabel,
  trimSentence,
} from "@/lib/gauge/tools/draftContext";
import { noMatchesResult, readToolQuery } from "@/lib/gauge/tools/shared";

export const draftLineSuggestionsTool = {
  type: "function" as const,
  function: {
    name: "draft_line_suggestions",
    description:
      "Draft estimate or change-order line suggestions from shop context without posting them.",
    parameters: {
      type: "object" as const,
      required: ["query"],
      properties: {
        query: {
          type: "string",
          description: "A work order, estimate, customer, or problem statement to draft line suggestions from.",
        },
        draftType: {
          type: "string",
          description: "Optional draft target: estimate or change_order. Defaults from the user's wording.",
        },
      },
    },
  },
};

export async function draftLineSuggestions(input: Record<string, unknown>) {
  const query = readToolQuery(input);

  if (!query) {
    return {
      found: false,
      message: "A work order or estimate query is required to draft line suggestions.",
    };
  }

  const draftType = normalizeDraftType(input.draftType, query);
  const workOrder = await findDraftWorkOrder(query);
  const estimate = !workOrder && draftType === "estimate" ? await findDraftEstimate(query) : null;

  if (!workOrder && !estimate) {
    return noMatchesResult(
      query,
      draftType === "change_order" ? "work orders for change-order suggestions" : "records for line suggestions",
    );
  }

  const existingDescriptions = workOrder
    ? [
        ...workOrder.lineItems.map((line) => line.description),
        ...workOrder.changeOrders.flatMap((changeOrder) => changeOrder.lineItems.map((line) => line.description)),
      ]
    : estimate?.lineItems.map((line) => line.description) ?? [];

  const contextText = [
    query,
    workOrder?.title,
    workOrder?.complaint,
    workOrder?.internalNotes,
    estimate?.title,
    estimate?.notes,
  ]
    .filter(Boolean)
    .join(" ");
  const lines = buildSuggestedLines({
    draftType,
    contextText,
    existingDescriptions,
  });

  const title = workOrder
    ? `${draftType === "change_order" ? "Change order" : "Estimate"} suggestions for ${workOrder.workOrderNumber}`
    : `${draftType === "change_order" ? "Change order" : "Estimate"} suggestions for ${estimate!.estimateNumber}`;
  const customerName = workOrder?.customer.displayName ?? estimate?.customer.displayName ?? "Active customer";
  const vehicleLabel = workOrder?.vehicle
    ? formatVehicleLabel(workOrder.vehicle)
    : estimate?.vehicle
      ? formatVehicleLabel(estimate.vehicle)
      : "Vehicle not linked";
  const recordLabel = workOrder?.workOrderNumber ?? estimate?.estimateNumber ?? "Draft record";
  const body = [
    `${title}`,
    "",
    buildLineDraftBody(lines),
    "",
    draftType === "change_order"
      ? "Review labor time, final parts, and customer approval before posting the change order."
      : "Review pricing, taxes, and final parts selection before posting the estimate.",
  ].join("\n");

  return {
    found: true,
    target: {
      draftType,
      recordLabel,
      customerName,
      vehicleLabel,
    },
    ...createDraftEnvelope([
      {
        kind: draftType === "change_order" ? "change_order_suggestions" : "estimate_suggestions",
        title,
        summary: `${lines.length} draft line suggestions for ${customerName}.`,
        body,
        format: "markdown",
        relatedHref: workOrder ? `/work-orders/${workOrder.id}` : `/estimates/${estimate!.id}`,
        relatedLabel: recordLabel,
        reviewItems: [
          { label: "Customer", value: customerName },
          { label: "Vehicle", value: vehicleLabel },
          {
            label: "Current context",
            value:
              trimSentence(workOrder?.complaint) ??
              trimSentence(estimate?.notes) ??
              trimSentence(workOrder?.title) ??
              trimSentence(estimate?.title) ??
              "No extra context captured",
          },
          {
            label: "Current total",
            value: formatMoney(
              workOrder
                ? workOrder.lineItems.reduce((sum, line) => sum + Number(line.lineTotal), 0)
                : estimate
                  ? Number(estimate.total)
                  : null,
            ),
          },
        ],
        lineItems: lines,
        metadata: {
          draftType,
          workOrderId: workOrder?.id ?? null,
          estimateId: estimate?.id ?? null,
        },
      },
    ]),
  };
}

function normalizeDraftType(value: unknown, query: string) {
  if (typeof value === "string" && value.trim().toLowerCase() === "change_order") {
    return "change_order" as const;
  }

  if (/\bchange\s*order\b/i.test(query)) {
    return "change_order" as const;
  }

  return "estimate" as const;
}
