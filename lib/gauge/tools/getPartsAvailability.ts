import { GaugeRetrievalSourceType } from "@/generated/prisma/client";
import type { CurrentUser } from "@/lib/auth";
import { searchGaugeRetrievalSource } from "@/lib/gauge/retrieval";
import {
  asBoolean,
  asNumber,
  asRecord,
  asString,
  noMatchesResult,
  readToolLimit,
  readToolQuery,
} from "@/lib/gauge/tools/shared";

export const getPartsAvailabilityTool = {
  type: "function" as const,
  function: {
    name: "get_parts_availability",
    description:
      "Look up stocked parts by SKU, name, manufacturer, or bin location and return current availability.",
    parameters: {
      type: "object" as const,
      required: ["query"],
      properties: {
        query: {
          type: "string",
          description: "Part SKU, name, manufacturer part number, or inventory wording from the user's question.",
        },
        limit: {
          type: "number",
          description: "Optional result limit. Defaults to 5 and caps at 8.",
        },
      },
    },
  },
};

export async function getPartsAvailability(
  input: Record<string, unknown>,
  user: CurrentUser,
) {
  const query = readToolQuery(input);

  if (!query) {
    return {
      found: false,
      message: "A part lookup query is required.",
    };
  }

  const results = await searchGaugeRetrievalSource({
    sourceType: GaugeRetrievalSourceType.PART,
    query,
    user,
    limit: readToolLimit(input),
  });

  if (results.length === 0) {
    return noMatchesResult(query, "parts");
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
        sku: asString(metadata.sku),
        name: asString(metadata.name),
        manufacturer: asString(metadata.manufacturer),
        manufacturerPartNumber: asString(metadata.manufacturerPartNumber),
        binLocation: asString(metadata.binLocation),
        vendorName: asString(metadata.vendorName),
        categoryName: asString(metadata.categoryName),
        unitOfMeasure: asString(metadata.unitOfMeasure),
        unitCost: asNumber(metadata.unitCost),
        quantityOnHand: asNumber(metadata.quantityOnHand),
        quantityReserved: asNumber(metadata.quantityReserved),
        quantityAvailable: asNumber(metadata.quantityAvailable),
        reorderPoint: asNumber(metadata.reorderPoint),
        belowReorderPoint: asBoolean(metadata.belowReorderPoint) ?? false,
      };
    }),
  };
}
