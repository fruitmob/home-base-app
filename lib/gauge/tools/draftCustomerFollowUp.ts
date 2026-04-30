import { createDraftEnvelope } from "@/lib/gauge/drafts";
import {
  findDraftWorkOrder,
  formatCustomerGreetingName,
  formatVehicleLabel,
  trimSentence,
} from "@/lib/gauge/tools/draftContext";
import { noMatchesResult, readToolQuery } from "@/lib/gauge/tools/shared";

export const draftCustomerFollowUpTool = {
  type: "function" as const,
  function: {
    name: "draft_customer_follow_up",
    description:
      "Draft a customer-facing follow-up message from work-order context without sending it.",
    parameters: {
      type: "object" as const,
      required: ["query"],
      properties: {
        query: {
          type: "string",
          description: "A work order number or identifying context for the customer update.",
        },
        channel: {
          type: "string",
          description: "Optional delivery channel hint such as text or email.",
        },
      },
    },
  },
};

export async function draftCustomerFollowUp(input: Record<string, unknown>) {
  const query = readToolQuery(input);
  const requestedChannel =
    typeof input.channel === "string" && input.channel.trim()
      ? input.channel.trim().toLowerCase()
      : null;

  if (!query) {
    return {
      found: false,
      message: "A work order query is required to draft a customer follow-up.",
    };
  }

  const workOrder = await findDraftWorkOrder(query);

  if (!workOrder) {
    return noMatchesResult(query, "work orders for a customer follow-up");
  }

  const channel = requestedChannel ?? inferChannel(query);
  const greetingName = formatCustomerGreetingName(workOrder.customer);
  const vehicleLabel = workOrder.vehicle ? formatVehicleLabel(workOrder.vehicle) : "the vehicle";
  const complaint = trimSentence(workOrder.complaint);
  const nextStep = buildNextStep(workOrder.status);
  const promised = workOrder.promisedAt
    ? workOrder.promisedAt.toLocaleDateString()
    : null;
  const body =
    channel === "email"
      ? [
          `Hi ${greetingName},`,
          "",
          `Quick update on ${workOrder.workOrderNumber} for ${vehicleLabel}. We currently have the work order marked ${formatStatus(workOrder.status)}.`,
          complaint ? `The shop is still focused on: ${complaint}.` : null,
          nextStep,
          promised ? `Our current target date is ${promised}.` : null,
          "If you want us to check anything else while the unit is here, reply and let us know.",
          "",
          "Thank you,",
          workOrder.serviceWriter?.email ?? "Home Base Service",
        ]
          .filter(Boolean)
          .join("\n")
      : `Hi ${greetingName}, quick update on ${workOrder.workOrderNumber} for ${vehicleLabel}: it is currently ${formatStatus(workOrder.status)}. ${complaint ? `Current focus is ${complaint}. ` : ""}${nextStep}${promised ? ` Target date is ${promised}.` : ""}`.trim();

  return {
    found: true,
    workOrder: {
      id: workOrder.id,
      workOrderNumber: workOrder.workOrderNumber,
      status: workOrder.status,
      customerName: workOrder.customer.displayName,
      vehicleLabel,
    },
    ...createDraftEnvelope([
      {
        kind: "customer_follow_up",
        title: `${channel === "email" ? "Email" : "Text"} follow-up for ${workOrder.workOrderNumber}`,
        summary: `Draft ${channel} update for ${workOrder.customer.displayName}.`,
        body,
        format: channel === "email" ? "markdown" : "text",
        relatedHref: `/work-orders/${workOrder.id}`,
        relatedLabel: workOrder.workOrderNumber,
        reviewItems: [
          { label: "Customer", value: workOrder.customer.displayName },
          { label: "Vehicle", value: vehicleLabel },
          { label: "Status", value: workOrder.status },
          {
            label: "Assigned tech",
            value: workOrder.assignedTech?.email ?? "Unassigned",
          },
          {
            label: "Promised date",
            value: promised ?? "Not set",
          },
        ],
        metadata: {
          channel,
          workOrderId: workOrder.id,
          customerId: workOrder.customerId,
        },
      },
    ]),
  };
}

function inferChannel(query: string) {
  return /\bemail\b/i.test(query) ? "email" : "text";
}

function buildNextStep(status: string) {
  if (status === "READY_TO_BILL") {
    return "The work is complete on the shop side and we are moving into final billing and closeout.";
  }

  if (status === "COMPLETED" || status === "CLOSED") {
    return "The repair work is complete and the team is wrapping up the final handoff.";
  }

  if (status === "IN_PROGRESS") {
    return "The team is actively working through the repair and verification steps.";
  }

  if (status === "ON_HOLD") {
    return "The work order is currently paused while the shop resolves the next blocker.";
  }

  return "The team is reviewing the next step and will keep the customer posted.";
}

function formatStatus(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}
