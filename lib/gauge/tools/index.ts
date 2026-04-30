import { Prisma } from "@/generated/prisma/client";
import type { CurrentUser } from "@/lib/auth";
import { extractGaugeDrafts } from "@/lib/gauge/drafts";
import type { GaugeToolSchema } from "@/lib/gauge/types";
import {
  draftCustomerFollowUp,
  draftCustomerFollowUpTool,
} from "@/lib/gauge/tools/draftCustomerFollowUp";
import {
  draftInternalNote,
  draftInternalNoteTool,
} from "@/lib/gauge/tools/draftInternalNote";
import {
  draftKbArticle,
  draftKbArticleTool,
} from "@/lib/gauge/tools/draftKbArticle";
import {
  draftLineSuggestions,
  draftLineSuggestionsTool,
} from "@/lib/gauge/tools/draftLineSuggestions";
import {
  getPartsAvailability,
  getPartsAvailabilityTool,
} from "@/lib/gauge/tools/getPartsAvailability";
import {
  getVehicleHistory,
  getVehicleHistoryTool,
} from "@/lib/gauge/tools/getVehicleHistory";
import {
  getWorkOrderStatus,
  getWorkOrderStatusTool,
} from "@/lib/gauge/tools/getWorkOrderStatus";
import { asNumber, asRecord, asRecordArray, asString } from "@/lib/gauge/tools/shared";
import { searchCases, searchCasesTool } from "@/lib/gauge/tools/searchCases";
import { searchCustomers, searchCustomersTool } from "@/lib/gauge/tools/searchCustomers";
import { searchEstimates, searchEstimatesTool } from "@/lib/gauge/tools/searchEstimates";
import { searchKbArticles, searchKbArticlesTool } from "@/lib/gauge/tools/searchKbArticles";
import {
  searchLensVideos,
  searchLensVideosTool,
} from "@/lib/gauge/tools/searchLensVideos";

type ToolResult = {
  output: Prisma.InputJsonValue;
  writeRequested: boolean;
  writePerformed: boolean;
};

type ToolHandler = {
  schema: GaugeToolSchema;
  writeRequested: boolean;
  execute: (input: Record<string, unknown>, user: CurrentUser) => Promise<unknown>;
};

const toolHandlers: Record<string, ToolHandler> = {
  get_work_order_status: {
    schema: getWorkOrderStatusTool,
    writeRequested: false,
    execute: (input) => getWorkOrderStatus(input),
  },
  search_customers: {
    schema: searchCustomersTool,
    writeRequested: false,
    execute: (input, user) => searchCustomers(input, user),
  },
  get_vehicle_history: {
    schema: getVehicleHistoryTool,
    writeRequested: false,
    execute: (input, user) => getVehicleHistory(input, user),
  },
  get_parts_availability: {
    schema: getPartsAvailabilityTool,
    writeRequested: false,
    execute: (input, user) => getPartsAvailability(input, user),
  },
  search_estimates: {
    schema: searchEstimatesTool,
    writeRequested: false,
    execute: (input, user) => searchEstimates(input, user),
  },
  search_cases: {
    schema: searchCasesTool,
    writeRequested: false,
    execute: (input, user) => searchCases(input, user),
  },
  search_kb_articles: {
    schema: searchKbArticlesTool,
    writeRequested: false,
    execute: (input, user) => searchKbArticles(input, user),
  },
  search_lens_videos: {
    schema: searchLensVideosTool,
    writeRequested: false,
    execute: (input, user) => searchLensVideos(input, user),
  },
  draft_customer_follow_up: {
    schema: draftCustomerFollowUpTool,
    writeRequested: false,
    execute: (input) => draftCustomerFollowUp(input),
  },
  draft_line_suggestions: {
    schema: draftLineSuggestionsTool,
    writeRequested: false,
    execute: (input) => draftLineSuggestions(input),
  },
  draft_kb_article: {
    schema: draftKbArticleTool,
    writeRequested: false,
    execute: (input) => draftKbArticle(input),
  },
  draft_internal_note: {
    schema: draftInternalNoteTool,
    writeRequested: false,
    execute: (input) => draftInternalNote(input),
  },
};

export const gaugeToolSchemas = Object.values(toolHandlers).map(
  (tool) => tool.schema,
) satisfies GaugeToolSchema[];

export async function executeGaugeTool(
  name: string,
  input: Record<string, unknown>,
  user: CurrentUser,
): Promise<ToolResult> {
  const tool = toolHandlers[name];

  if (!tool) {
    return {
      output: { error: `Unknown Gauge tool: ${name}` },
      writeRequested: false,
      writePerformed: false,
    };
  }

  const output = await tool.execute(input, user);

  return {
    output: JSON.parse(JSON.stringify(output)) as Prisma.InputJsonValue,
    writeRequested: tool.writeRequested,
    writePerformed: false,
  };
}

export function collectDraftsFromToolOutputs(outputs: Array<{ output: unknown }>) {
  return outputs.flatMap((result) => extractGaugeDrafts(result.output));
}

export function summarizeToolOutputs(outputs: Array<{ toolName: string; output: unknown }>) {
  const summaries = outputs
    .map((result) => summarizeToolOutput(result.toolName, result.output))
    .filter((summary): summary is string => !!summary);

  return summaries[0] ?? "I looked that up, but I do not have a summary formatter for that tool yet.";
}

function summarizeToolOutput(toolName: string, output: unknown) {
  if (toolName === "get_work_order_status") {
    return summarizeWorkOrderStatus(output);
  }

  if (toolName === "search_customers") {
    return summarizeCustomerResults(output);
  }

  if (toolName === "get_vehicle_history") {
    return summarizeVehicleHistory(output);
  }

  if (toolName === "get_parts_availability") {
    return summarizePartAvailability(output);
  }

  if (toolName === "search_estimates") {
    return summarizeEstimateResults(output);
  }

  if (toolName === "search_cases") {
    return summarizeCaseResults(output);
  }

  if (toolName === "search_kb_articles") {
    return summarizeKbResults(output);
  }

  if (toolName === "search_lens_videos") {
    return summarizeLensResults(output);
  }

  if (
    toolName === "draft_customer_follow_up" ||
    toolName === "draft_line_suggestions" ||
    toolName === "draft_kb_article" ||
    toolName === "draft_internal_note"
  ) {
    return summarizeDraftResult(output);
  }

  return null;
}

function summarizeWorkOrderStatus(output: unknown) {
  const result = asRecord(output);
  const workOrder = asRecord(result.workOrder);

  if (result.found !== true || Object.keys(workOrder).length === 0) {
    return asString(result.message) ?? "I could not find a matching active work order.";
  }

  const customer = asRecord(workOrder.customer);
  const vehicle = asRecord(workOrder.vehicle);
  const bay = asRecord(workOrder.bay);
  const assignedTech = asRecord(workOrder.assignedTech);
  const counts = asRecord(workOrder.counts);

  const details = [
    `${asString(workOrder.workOrderNumber) ?? "That work order"} is ${formatStatus(asString(workOrder.status))} (${formatStatus(asString(workOrder.priority))} priority).`,
    asString(workOrder.title) ? `Title: ${asString(workOrder.title)}.` : null,
    asString(customer.displayName) ? `Customer: ${asString(customer.displayName)}.` : null,
    asString(vehicle.label) ? `Vehicle: ${asString(vehicle.label)}.` : null,
    asString(bay.name) ? `Bay: ${asString(bay.name)}.` : "Bay: unassigned.",
    asString(assignedTech.email)
      ? `Assigned tech: ${asString(assignedTech.email)}.`
      : "Assigned tech: unassigned.",
    asString(workOrder.promisedAt)
      ? `Promised: ${formatDate(asString(workOrder.promisedAt))}.`
      : null,
    Object.keys(counts).length > 0
      ? `Activity: ${asNumber(counts.lineItems) ?? 0} line items, ${asNumber(counts.timeEntries) ?? 0} time entries, ${asNumber(counts.partReservations) ?? 0} part reservations, ${asNumber(counts.changeOrders) ?? 0} change orders, ${asNumber(counts.videos) ?? 0} videos.`
      : null,
  ].filter(Boolean);

  return details.join(" ");
}

function summarizeCustomerResults(output: unknown) {
  const result = asRecord(output);
  const results = asRecordArray(result.results);

  if (result.found !== true || results.length === 0) {
    return asString(result.message) ?? "I could not find a matching customer.";
  }

  const customer = results[0]!;
  const recentVehicles = asRecordArray(customer.recentVehicles)
    .map((vehicle) => asString(vehicle.label))
    .filter((value): value is string => !!value);
  const recentWorkOrders = asRecordArray(customer.recentWorkOrders)
    .map((workOrder) => asString(workOrder.workOrderNumber))
    .filter((value): value is string => !!value);

  return [
    `${asString(customer.displayName) ?? "Customer"} matched your search.`,
    asString(customer.summary) ? `${asString(customer.summary)}.` : null,
    recentVehicles.length > 0 ? `Recent vehicles: ${recentVehicles.slice(0, 2).join(", ")}.` : null,
    recentWorkOrders.length > 0
      ? `Recent work orders: ${recentWorkOrders.slice(0, 2).join(", ")}.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");
}

function summarizeVehicleHistory(output: unknown) {
  const result = asRecord(output);
  const vehicle = asRecord(result.vehicle);

  if (result.found !== true || Object.keys(vehicle).length === 0) {
    return asString(result.message) ?? "I could not find a matching vehicle.";
  }

  const workOrders = asRecordArray(vehicle.recentWorkOrders)
    .map((workOrder) => asString(workOrder.workOrderNumber))
    .filter((value): value is string => !!value);
  const mileageReadings = asRecordArray(vehicle.recentMileageReadings);

  return [
    `${asString(vehicle.label) ?? "Vehicle"} belongs to ${asString(vehicle.customerName) ?? "an active customer"}.`,
    asNumber(vehicle.currentMileage) != null
      ? `Current mileage: ${Number(asNumber(vehicle.currentMileage)).toLocaleString()} mi.`
      : null,
    workOrders.length > 0 ? `Recent work orders: ${workOrders.slice(0, 3).join(", ")}.` : null,
    mileageReadings[0]
      ? `Latest mileage reading: ${Number(asNumber(asRecord(mileageReadings[0]).value) ?? 0).toLocaleString()} mi.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");
}

function summarizePartAvailability(output: unknown) {
  const result = asRecord(output);
  const results = asRecordArray(result.results);

  if (result.found !== true || results.length === 0) {
    return asString(result.message) ?? "I could not find a matching part.";
  }

  const part = results[0]!;

  return [
    `${asString(part.label) ?? "Part"} is in inventory.`,
    asNumber(part.quantityAvailable) != null
      ? `Available: ${Number(asNumber(part.quantityAvailable)).toFixed(2)} ${asString(part.unitOfMeasure) ?? "units"}.`
      : null,
    asString(part.binLocation) ? `Bin: ${asString(part.binLocation)}.` : null,
    asString(part.vendorName) ? `Vendor: ${asString(part.vendorName)}.` : null,
    asRecord(part).belowReorderPoint === true ? "It is at or below its reorder point." : null,
  ]
    .filter(Boolean)
    .join(" ");
}

function summarizeEstimateResults(output: unknown) {
  const result = asRecord(output);
  const results = asRecordArray(result.results);

  if (result.found !== true || results.length === 0) {
    return asString(result.message) ?? "I could not find a matching estimate.";
  }

  const estimate = results[0]!;

  return [
    `${asString(estimate.estimateNumber) ?? "Estimate"} is ${formatStatus(asString(estimate.status))}.`,
    asString(estimate.customerName) ? `Customer: ${asString(estimate.customerName)}.` : null,
    asString(estimate.vehicleLabel) ? `Vehicle: ${asString(estimate.vehicleLabel)}.` : null,
    asNumber(estimate.total) != null
      ? `Total: $${Number(asNumber(estimate.total)).toFixed(2)}.`
      : null,
    asString(estimate.convertedWorkOrderNumber)
      ? `Converted to ${asString(estimate.convertedWorkOrderNumber)}.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");
}

function summarizeCaseResults(output: unknown) {
  const result = asRecord(output);
  const results = asRecordArray(result.results);

  if (result.found !== true || results.length === 0) {
    return asString(result.message) ?? "I could not find a matching case.";
  }

  const supportCase = results[0]!;

  return [
    `${asString(supportCase.subject) ?? "Case"} is ${formatStatus(asString(supportCase.status))} (${formatStatus(asString(supportCase.priority))} priority).`,
    asString(supportCase.customerName) ? `Customer: ${asString(supportCase.customerName)}.` : null,
    asString(supportCase.assignedUserEmail)
      ? `Assigned to ${asString(supportCase.assignedUserEmail)}.`
      : "The case is unassigned.",
    asString(supportCase.description) ? `${asString(supportCase.description)}.` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

function summarizeKbResults(output: unknown) {
  const result = asRecord(output);
  const results = asRecordArray(result.results);

  if (result.found !== true || results.length === 0) {
    return asString(result.message) ?? "I could not find a matching knowledge-base article.";
  }

  const article = results[0]!;

  return [
    `I found "${asString(article.title) ?? "that article"}".`,
    asString(article.categoryName) ? `Category: ${asString(article.categoryName)}.` : null,
    asString(article.status) ? `Status: ${formatStatus(asString(article.status))}.` : null,
    asString(article.excerpt) ? `${asString(article.excerpt)}.` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

function summarizeLensResults(output: unknown) {
  const result = asRecord(output);
  const results = asRecordArray(result.results);

  if (result.found !== true || results.length === 0) {
    return asString(result.message) ?? "I could not find a matching Lens video.";
  }

  const video = results[0]!;

  return [
    `"${asString(video.title) ?? "Video"}" is ${formatStatus(asString(video.status))}.`,
    asString(video.workOrderNumber) ? `Work order: ${asString(video.workOrderNumber)}.` : null,
    asString(video.customerName) ? `Customer: ${asString(video.customerName)}.` : null,
    asString(video.vehicleLabel) ? `Vehicle: ${asString(video.vehicleLabel)}.` : null,
    asNumber(video.latestShareViewCount) != null
      ? `Latest share views: ${asNumber(video.latestShareViewCount)}.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");
}

function summarizeDraftResult(output: unknown) {
  const drafts = extractGaugeDrafts(output);

  if (drafts.length === 0) {
    const result = asRecord(output);
    return asString(result.message) ?? "I could not produce that draft yet.";
  }

  const draft = drafts[0]!;

  return [
    draft.summary,
    draft.body,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function formatStatus(value: string | null) {
  return value ? value.replaceAll("_", " ").toLowerCase() : "unknown";
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : "unknown";
}
