import { createDraftEnvelope } from "@/lib/gauge/drafts";
import {
  findDraftCase,
  findDraftVehicle,
  findDraftWorkOrder,
  formatVehicleLabel,
  trimSentence,
} from "@/lib/gauge/tools/draftContext";
import { noMatchesResult, readToolQuery } from "@/lib/gauge/tools/shared";

export const draftKbArticleTool = {
  type: "function" as const,
  function: {
    name: "draft_kb_article",
    description:
      "Draft a knowledge-base article in markdown from work-order, case, or vehicle context without publishing it.",
    parameters: {
      type: "object" as const,
      required: ["query"],
      properties: {
        query: {
          type: "string",
          description: "A work order, vehicle, case, or operational topic to turn into a KB article draft.",
        },
      },
    },
  },
};

export async function draftKbArticle(input: Record<string, unknown>) {
  const query = readToolQuery(input);

  if (!query) {
    return {
      found: false,
      message: "A work-order or operational topic query is required to draft a KB article.",
    };
  }

  const workOrder = await findDraftWorkOrder(query);
  const supportCase = !workOrder ? await findDraftCase(query) : null;
  const vehicle = !workOrder && !supportCase ? await findDraftVehicle(query) : null;

  if (!workOrder && !supportCase && !vehicle) {
    return noMatchesResult(query, "shop records for a KB draft");
  }

  const title = buildKbTitle({ workOrder, supportCase, vehicle });
  const summarySource = workOrder
    ? `${workOrder.workOrderNumber} - ${workOrder.title}`
    : supportCase
      ? supportCase.subject
      : formatVehicleLabel(vehicle!);
  const body = workOrder
    ? buildKbBodyFromWorkOrder(workOrder)
    : supportCase
      ? buildKbBodyFromCase(supportCase)
      : buildKbBodyFromVehicle(vehicle!);

  return {
    found: true,
    ...createDraftEnvelope([
      {
        kind: "kb_article",
        title,
        summary: `Markdown KB draft built from ${summarySource}.`,
        body,
        format: "markdown",
        relatedHref: workOrder
          ? `/work-orders/${workOrder.id}`
          : supportCase
            ? `/cases/${supportCase.id}`
            : `/vehicles/${vehicle!.id}`,
        relatedLabel: summarySource,
        reviewItems: [
          {
            label: "Source",
            value: summarySource,
          },
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
      },
    ]),
  };
}

function buildKbTitle({
  workOrder,
  supportCase,
  vehicle,
}: {
  workOrder: Awaited<ReturnType<typeof findDraftWorkOrder>> | null;
  supportCase: Awaited<ReturnType<typeof findDraftCase>> | null;
  vehicle: Awaited<ReturnType<typeof findDraftVehicle>> | null;
}) {
  const base =
    trimSentence(workOrder?.title) ??
    trimSentence(supportCase?.subject) ??
    trimSentence(vehicle?.vehicleNotes[0]?.body) ??
    "Shop Procedure";

  return `${base.replace(/[.:]+$/g, "")} SOP`;
}

function buildKbBodyFromWorkOrder(workOrder: NonNullable<Awaited<ReturnType<typeof findDraftWorkOrder>>>) {
  const lineHighlights = workOrder.lineItems
    .slice(0, 5)
    .map((line) => `- ${line.description}`);
  const statusHighlights = workOrder.statusHistory
    .slice(0, 3)
    .map((entry) => `- ${entry.toStatus}${entry.reason ? `: ${entry.reason}` : ""}`);

  return [
    `# ${workOrder.title}`,
    "",
    "## Overview",
    trimSentence(workOrder.complaint) ??
      "This article captures the standard process the shop followed on a real work order.",
    "",
    "## When To Use This",
    `Use this procedure when the shop is handling work similar to ${workOrder.workOrderNumber} for ${
      workOrder.vehicle ? formatVehicleLabel(workOrder.vehicle) : "a similar unit"
    }.`,
    "",
    "## Recommended Steps",
    ...lineHighlights,
    lineHighlights.length === 0 ? "- Inspect the unit, confirm the complaint, and document findings." : null,
    "",
    "## Verification",
    ...statusHighlights,
    statusHighlights.length === 0
      ? "- Confirm the repair path, complete the verification step, and document the outcome."
      : null,
    "",
    "## Notes",
    trimSentence(workOrder.internalNotes) ??
      "Replace placeholders with finalized technician guidance before publishing.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildKbBodyFromCase(supportCase: NonNullable<Awaited<ReturnType<typeof findDraftCase>>>) {
  return [
    `# ${supportCase.subject}`,
    "",
    "## Overview",
    trimSentence(supportCase.description) ?? "This draft is based on an active customer care case.",
    "",
    "## Trigger",
    `Customer: ${supportCase.customer.displayName}`,
    supportCase.vehicle ? `Vehicle: ${formatVehicleLabel(supportCase.vehicle)}` : null,
    "",
    "## Response Pattern",
    "- Confirm the concern and collect the latest shop context.",
    "- Review the assigned owner, current status, and next promised action.",
    "- Capture any resolution notes before closing the loop with the customer.",
    "",
    "## Follow-Up Checklist",
    supportCase.assignedUser?.email
      ? `- Current assignee: ${supportCase.assignedUser.email}`
      : "- Assign an owner before publishing this process.",
    `- Current case status: ${supportCase.status}`,
    `- Priority level: ${supportCase.priority}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildKbBodyFromVehicle(vehicle: NonNullable<Awaited<ReturnType<typeof findDraftVehicle>>>) {
  const recentNotes = vehicle.vehicleNotes.slice(0, 3).map((note) => `- ${trimSentence(note.body)}`);

  return [
    `# ${formatVehicleLabel(vehicle)}`,
    "",
    "## Overview",
    "This draft captures a reusable process from vehicle-level history and notes.",
    "",
    "## Context",
    `Customer: ${vehicle.customer.displayName}`,
    vehicle.currentMileage != null ? `Current mileage: ${vehicle.currentMileage}` : null,
    "",
    "## Key Findings",
    ...recentNotes,
    recentNotes.length === 0 ? "- Add shop-specific findings before publishing." : null,
    "",
    "## Repeatable Steps",
    "- Verify the concern against prior vehicle notes and work-order history.",
    "- Document the latest reading or inspection result.",
    "- Convert the confirmed steps into a published SOP once the shop agrees on the workflow.",
  ]
    .filter(Boolean)
    .join("\n");
}
