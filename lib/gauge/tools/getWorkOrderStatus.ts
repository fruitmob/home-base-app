import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export const getWorkOrderStatusTool = {
  type: "function" as const,
  function: {
    name: "get_work_order_status",
    description:
      "Look up a work order by number, title, customer, or vehicle text and return current status context.",
    parameters: {
      type: "object" as const,
      required: ["query"],
      properties: {
        query: {
          type: "string",
          description: "A work order number or search phrase from the user's question.",
        },
      },
    },
  },
};

export async function getWorkOrderStatus(input: Record<string, unknown>) {
  const query = typeof input.query === "string" ? input.query.trim() : "";

  if (!query) {
    return {
      found: false,
      message: "A work order number or search phrase is required.",
    };
  }

  const normalizedWoNumber = normalizeWorkOrderNumber(query);
  const workOrder = await db.workOrder.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { workOrderNumber: { equals: normalizedWoNumber, mode: Prisma.QueryMode.insensitive } },
        { workOrderNumber: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { title: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { customer: { displayName: { contains: query, mode: Prisma.QueryMode.insensitive } } },
        { vehicle: { unitNumber: { contains: query, mode: Prisma.QueryMode.insensitive } } },
        { vehicle: { licensePlate: { contains: query, mode: Prisma.QueryMode.insensitive } } },
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { id: true, displayName: true, phone: true, email: true } },
      vehicle: {
        select: {
          id: true,
          year: true,
          make: true,
          model: true,
          unitNumber: true,
          licensePlate: true,
        },
      },
      bay: { select: { id: true, name: true } },
      serviceWriter: { select: { id: true, email: true } },
      assignedTech: { select: { id: true, email: true } },
      _count: {
        select: {
          lineItems: true,
          timeEntries: true,
          partReservations: true,
          changeOrders: true,
          videos: true,
        },
      },
    },
  });

  if (!workOrder) {
    return {
      found: false,
      query,
      message: `No active work order matched "${query}".`,
    };
  }

  return {
    found: true,
    workOrder: {
      id: workOrder.id,
      workOrderNumber: workOrder.workOrderNumber,
      title: workOrder.title,
      status: workOrder.status,
      priority: workOrder.priority,
      customer: workOrder.customer,
      vehicle: workOrder.vehicle
        ? {
            ...workOrder.vehicle,
            label: [
              workOrder.vehicle.unitNumber ? `Unit ${workOrder.vehicle.unitNumber}` : null,
              workOrder.vehicle.year,
              workOrder.vehicle.make,
              workOrder.vehicle.model,
            ]
              .filter(Boolean)
              .join(" "),
          }
        : null,
      bay: workOrder.bay,
      serviceWriter: workOrder.serviceWriter,
      assignedTech: workOrder.assignedTech,
      openedAt: workOrder.openedAt,
      promisedAt: workOrder.promisedAt,
      completedAt: workOrder.completedAt,
      closedAt: workOrder.closedAt,
      counts: workOrder._count,
    },
  };
}

function normalizeWorkOrderNumber(query: string) {
  const match = query.match(/\bWO[-\s]?\d{6}[-\s]?\d{4}\b/i);

  if (!match) {
    return query;
  }

  return match[0].replace(/\s+/g, "-").toUpperCase();
}
