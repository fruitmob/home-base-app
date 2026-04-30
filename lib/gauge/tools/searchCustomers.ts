import { GaugeRetrievalSourceType } from "@/generated/prisma/client";
import type { CurrentUser } from "@/lib/auth";
import { searchGaugeRetrievalSource } from "@/lib/gauge/retrieval";
import {
  asBoolean,
  asRecord,
  asRecordArray,
  asString,
  noMatchesResult,
  readToolLimit,
  readToolQuery,
} from "@/lib/gauge/tools/shared";

export const searchCustomersTool = {
  type: "function" as const,
  function: {
    name: "search_customers",
    description:
      "Look up customers by name, company, contact info, vehicles, or recent operational history.",
    parameters: {
      type: "object" as const,
      required: ["query"],
      properties: {
        query: {
          type: "string",
          description: "Customer name, email, phone, vehicle, or shop context from the user's question.",
        },
        limit: {
          type: "number",
          description: "Optional result limit. Defaults to 5 and caps at 8.",
        },
      },
    },
  },
};

export async function searchCustomers(
  input: Record<string, unknown>,
  user: CurrentUser,
) {
  const query = readToolQuery(input);

  if (!query) {
    return {
      found: false,
      message: "A customer lookup query is required.",
    };
  }

  const results = await searchGaugeRetrievalSource({
    sourceType: GaugeRetrievalSourceType.CUSTOMER,
    query,
    user,
    limit: readToolLimit(input),
  });

  if (results.length === 0) {
    return noMatchesResult(query, "customers");
  }

  return {
    found: true,
    query,
    results: results.map((result) => {
      const metadata = asRecord(result.metadata);

      return {
        id: result.sourceId,
        displayName: result.title,
        href: result.href,
        summary: result.summary,
        customerType: asString(metadata.customerType),
        email: asString(metadata.email),
        phone: asString(metadata.phone),
        isWalkIn: asBoolean(metadata.isWalkIn) ?? false,
        notes: asString(metadata.notes),
        contacts: asRecordArray(metadata.contacts).map((contact) => ({
          displayName: asString(contact.displayName),
          email: asString(contact.email),
          phone: asString(contact.phone),
        })),
        recentVehicles: asRecordArray(metadata.recentVehicles).map((vehicle) => ({
          id: asString(vehicle.id),
          label: asString(vehicle.label),
          licensePlate: asString(vehicle.licensePlate),
        })),
        recentWorkOrders: asRecordArray(metadata.recentWorkOrders).map((workOrder) => ({
          id: asString(workOrder.id),
          workOrderNumber: asString(workOrder.workOrderNumber),
          title: asString(workOrder.title),
          status: asString(workOrder.status),
        })),
        recentCases: asRecordArray(metadata.recentCases).map((supportCase) => ({
          id: asString(supportCase.id),
          subject: asString(supportCase.subject),
          status: asString(supportCase.status),
          priority: asString(supportCase.priority),
        })),
        recentEstimates: asRecordArray(metadata.recentEstimates).map((estimate) => ({
          id: asString(estimate.id),
          estimateNumber: asString(estimate.estimateNumber),
          title: asString(estimate.title),
          status: asString(estimate.status),
        })),
      };
    }),
  };
}
