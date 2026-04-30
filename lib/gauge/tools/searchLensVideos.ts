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

export const searchLensVideosTool = {
  type: "function" as const,
  function: {
    name: "search_lens_videos",
    description:
      "Search Lens videos by title, description, work order, customer, vehicle, or upload metadata.",
    parameters: {
      type: "object" as const,
      required: ["query"],
      properties: {
        query: {
          type: "string",
          description: "A video title, work order number, customer, vehicle, or Lens phrase from the user's question.",
        },
        limit: {
          type: "number",
          description: "Optional result limit. Defaults to 5 and caps at 8.",
        },
      },
    },
  },
};

export async function searchLensVideos(
  input: Record<string, unknown>,
  user: CurrentUser,
) {
  const query = readToolQuery(input);

  if (!query) {
    return {
      found: false,
      message: "A Lens video search query is required.",
    };
  }

  const results = await searchGaugeRetrievalSource({
    sourceType: GaugeRetrievalSourceType.VIDEO,
    query,
    user,
    limit: readToolLimit(input),
  });

  if (results.length === 0) {
    return noMatchesResult(query, "Lens videos");
  }

  return {
    found: true,
    query,
    results: results.map((result) => {
      const metadata = asRecord(result.metadata);

      return {
        id: result.sourceId,
        title: result.title,
        href: result.href,
        summary: result.summary,
        status: asString(metadata.status),
        customerName: asString(metadata.customerName),
        vehicleLabel: asString(metadata.vehicleLabel),
        workOrderNumber: asString(metadata.workOrderNumber),
        workOrderTitle: asString(metadata.workOrderTitle),
        uploadedByUserEmail: asString(metadata.uploadedByUserEmail),
        durationSeconds: asNumber(metadata.durationSeconds),
        latestShareExpiresAt: asString(metadata.latestShareExpiresAt),
        latestShareViewCount: asNumber(metadata.latestShareViewCount),
        description: asString(metadata.description),
        createdAt: asString(metadata.createdAt),
      };
    }),
  };
}
