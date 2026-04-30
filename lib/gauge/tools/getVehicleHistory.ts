import { GaugeRetrievalSourceType } from "@/generated/prisma/client";
import type { CurrentUser } from "@/lib/auth";
import { searchGaugeRetrievalSource } from "@/lib/gauge/retrieval";
import {
  asNumber,
  asRecord,
  asRecordArray,
  asString,
  noMatchesResult,
  readToolLimit,
  readToolQuery,
} from "@/lib/gauge/tools/shared";

export const getVehicleHistoryTool = {
  type: "function" as const,
  function: {
    name: "get_vehicle_history",
    description:
      "Find a vehicle by unit number, VIN, plate, customer, or description and return recent operational history.",
    parameters: {
      type: "object" as const,
      required: ["query"],
      properties: {
        query: {
          type: "string",
          description: "A vehicle unit number, VIN, plate, customer name, or other identifying text.",
        },
        limit: {
          type: "number",
          description: "Optional result limit. Defaults to 3 when multiple vehicles match.",
        },
      },
    },
  },
};

export async function getVehicleHistory(
  input: Record<string, unknown>,
  user: CurrentUser,
) {
  const query = readToolQuery(input);

  if (!query) {
    return {
      found: false,
      message: "A vehicle lookup query is required.",
    };
  }

  const results = await searchGaugeRetrievalSource({
    sourceType: GaugeRetrievalSourceType.VEHICLE,
    query,
    user,
    limit: readToolLimit(input, 3, 5),
  });

  if (results.length === 0) {
    return noMatchesResult(query, "vehicles");
  }

  const primary = results[0]!;
  const metadata = asRecord(primary.metadata);

  return {
    found: true,
    query,
    vehicle: {
      id: primary.sourceId,
      label: primary.title,
      href: primary.href,
      summary: primary.summary,
      customerName: asString(metadata.customerName),
      unitNumber: asString(metadata.unitNumber),
      normalizedVin: asString(metadata.normalizedVin),
      licensePlate: asString(metadata.licensePlate),
      currentMileage: asNumber(metadata.currentMileage),
      notes: asString(metadata.notes),
      recentWorkOrders: asRecordArray(metadata.recentWorkOrders).map((workOrder) => ({
        id: asString(workOrder.id),
        workOrderNumber: asString(workOrder.workOrderNumber),
        title: asString(workOrder.title),
        status: asString(workOrder.status),
        priority: asString(workOrder.priority),
        createdAt: asString(workOrder.createdAt),
      })),
      recentMileageReadings: asRecordArray(metadata.recentMileageReadings).map((reading) => ({
        value: asNumber(reading.value),
        source: asString(reading.source),
        note: asString(reading.note),
        recordedAt: asString(reading.recordedAt),
      })),
      recentNotes: asRecordArray(metadata.recentNotes).map((note) => ({
        type: asString(note.type),
        body: asString(note.body),
        createdAt: asString(note.createdAt),
      })),
      recentVideos: asRecordArray(metadata.recentVideos).map((video) => ({
        id: asString(video.id),
        title: asString(video.title),
        status: asString(video.status),
        createdAt: asString(video.createdAt),
      })),
    },
    alternatives: results.slice(1).map((result) => ({
      id: result.sourceId,
      label: result.title,
      href: result.href,
      summary: result.summary,
    })),
  };
}
