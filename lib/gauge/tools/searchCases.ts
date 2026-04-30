import { GaugeRetrievalSourceType } from "@/generated/prisma/client";
import type { CurrentUser } from "@/lib/auth";
import { searchGaugeRetrievalSource } from "@/lib/gauge/retrieval";
import {
  asRecord,
  asString,
  noMatchesResult,
  readToolLimit,
  readToolQuery,
} from "@/lib/gauge/tools/shared";

export const searchCasesTool = {
  type: "function" as const,
  function: {
    name: "search_cases",
    description:
      "Find support and follow-up cases by subject, customer, vehicle, assignee, or resolution details.",
    parameters: {
      type: "object" as const,
      required: ["query"],
      properties: {
        query: {
          type: "string",
          description: "Case subject text, customer, vehicle, assignee, or support wording from the user's question.",
        },
        limit: {
          type: "number",
          description: "Optional result limit. Defaults to 5 and caps at 8.",
        },
      },
    },
  },
};

export async function searchCases(
  input: Record<string, unknown>,
  user: CurrentUser,
) {
  const query = readToolQuery(input);

  if (!query) {
    return {
      found: false,
      message: "A case lookup query is required.",
    };
  }

  const results = await searchGaugeRetrievalSource({
    sourceType: GaugeRetrievalSourceType.CASE,
    query,
    user,
    limit: readToolLimit(input),
  });

  if (results.length === 0) {
    return noMatchesResult(query, "cases");
  }

  return {
    found: true,
    query,
    results: results.map((result) => {
      const metadata = asRecord(result.metadata);

      return {
        id: result.sourceId,
        subject: result.title,
        href: result.href,
        summary: result.summary,
        customerName: asString(metadata.customerName),
        vehicleLabel: asString(metadata.vehicleLabel),
        status: asString(metadata.status),
        priority: asString(metadata.priority),
        assignedUserEmail: asString(metadata.assignedUserEmail),
        openedByUserEmail: asString(metadata.openedByUserEmail),
        description: asString(metadata.description),
        resolutionNotes: asString(metadata.resolutionNotes),
        resolvedAt: asString(metadata.resolvedAt),
        updatedAt: asString(metadata.updatedAt),
      };
    }),
  };
}
