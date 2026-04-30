import { GaugeRetrievalSourceType } from "@/generated/prisma/client";
import type { CurrentUser } from "@/lib/auth";
import { searchGaugeRetrievalSource } from "@/lib/gauge/retrieval";
import {
  asNumber,
  asRecord,
  asString,
  noMatchesResult,
  readToolLimit,
  readToolQuery,
} from "@/lib/gauge/tools/shared";

export const searchEstimatesTool = {
  type: "function" as const,
  function: {
    name: "search_estimates",
    description:
      "Find estimates by estimate number, title, customer, vehicle, or notes and return current quoting context.",
    parameters: {
      type: "object" as const,
      required: ["query"],
      properties: {
        query: {
          type: "string",
          description: "An estimate number, customer, vehicle, or related text from the user's question.",
        },
        limit: {
          type: "number",
          description: "Optional result limit. Defaults to 5 and caps at 8.",
        },
      },
    },
  },
};

export async function searchEstimates(
  input: Record<string, unknown>,
  user: CurrentUser,
) {
  const query = readToolQuery(input);

  if (!query) {
    return {
      found: false,
      message: "An estimate lookup query is required.",
    };
  }

  const results = await searchGaugeRetrievalSource({
    sourceType: GaugeRetrievalSourceType.ESTIMATE,
    query,
    user,
    limit: readToolLimit(input),
  });

  if (results.length === 0) {
    return noMatchesResult(query, "estimates");
  }

  return {
    found: true,
    query,
    results: results.map((result) => {
      const metadata = asRecord(result.metadata);

      return {
        id: result.sourceId,
        label: result.title,
        href: result.href,
        summary: result.summary,
        estimateNumber: asString(metadata.estimateNumber),
        status: asString(metadata.status),
        customerName: asString(metadata.customerName),
        vehicleLabel: asString(metadata.vehicleLabel),
        total: asNumber(metadata.total),
        subtotal: asNumber(metadata.subtotal),
        taxTotal: asNumber(metadata.taxTotal),
        validUntil: asString(metadata.validUntil),
        sentAt: asString(metadata.sentAt),
        approvedAt: asString(metadata.approvedAt),
        declinedAt: asString(metadata.declinedAt),
        convertedWorkOrderNumber: asString(metadata.convertedWorkOrderNumber),
        notes: asString(metadata.notes),
      };
    }),
  };
}
