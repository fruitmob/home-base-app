import { Prisma, type WorkOrderLineType } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export const draftWorkOrderInclude = {
  customer: {
    select: {
      id: true,
      displayName: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
    },
  },
  vehicle: {
    select: {
      id: true,
      year: true,
      make: true,
      model: true,
      unitNumber: true,
      licensePlate: true,
      normalizedVin: true,
      currentMileage: true,
    },
  },
  serviceWriter: { select: { id: true, email: true } },
  assignedTech: { select: { id: true, email: true } },
  lineItems: {
    where: { deletedAt: null },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    include: {
      product: { select: { id: true, sku: true, name: true } },
      part: {
        select: {
          id: true,
          sku: true,
          name: true,
          manufacturer: true,
          manufacturerPartNumber: true,
          quantityOnHand: true,
          quantityReserved: true,
          unitCost: true,
        },
      },
    },
  },
  changeOrders: {
    where: { deletedAt: null },
    orderBy: [{ createdAt: "desc" }],
    take: 3,
    include: {
      lineItems: {
        where: { deletedAt: null },
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  },
  statusHistory: {
    orderBy: [{ createdAt: "desc" }],
    take: 5,
    include: {
      changedByUser: { select: { email: true } },
    },
  },
  videos: {
    where: { deletedAt: null },
    orderBy: [{ createdAt: "desc" }],
    take: 3,
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
    },
  },
} satisfies Prisma.WorkOrderInclude;

export const draftEstimateInclude = {
  customer: {
    select: {
      id: true,
      displayName: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
    },
  },
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
  lineItems: {
    where: { deletedAt: null },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    include: {
      product: { select: { id: true, sku: true, name: true } },
      part: { select: { id: true, sku: true, name: true, quantityOnHand: true, quantityReserved: true } },
    },
  },
  createdByUser: {
    select: { id: true, email: true },
  },
  convertedWorkOrder: {
    select: { id: true, workOrderNumber: true },
  },
} satisfies Prisma.EstimateInclude;

export const draftCaseInclude = {
  customer: {
    select: {
      id: true,
      displayName: true,
      email: true,
      phone: true,
    },
  },
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
  assignedUser: { select: { id: true, email: true } },
  openedByUser: { select: { id: true, email: true } },
} satisfies Prisma.CaseInclude;

export const draftVehicleInclude = {
  customer: {
    select: {
      id: true,
      displayName: true,
      email: true,
      phone: true,
    },
  },
  vehicleNotes: {
    orderBy: [{ createdAt: "desc" }],
    take: 5,
  },
  mileageReadings: {
    orderBy: [{ recordedAt: "desc" }, { createdAt: "desc" }],
    take: 5,
  },
  workOrders: {
    where: { deletedAt: null },
    orderBy: [{ createdAt: "desc" }],
    take: 5,
    select: {
      id: true,
      workOrderNumber: true,
      title: true,
      status: true,
      priority: true,
    },
  },
} satisfies Prisma.VehicleInclude;

export async function findDraftWorkOrder(query: string) {
  const normalizedWoNumber = normalizeWorkOrderNumber(query);

  return db.workOrder.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { workOrderNumber: { equals: normalizedWoNumber, mode: Prisma.QueryMode.insensitive } },
        { workOrderNumber: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { title: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { complaint: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { internalNotes: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { customer: { displayName: { contains: query, mode: Prisma.QueryMode.insensitive } } },
        { vehicle: { unitNumber: { contains: query, mode: Prisma.QueryMode.insensitive } } },
        {
          vehicle: {
            normalizedVin: { contains: query.toUpperCase(), mode: Prisma.QueryMode.insensitive },
          },
        },
      ],
    },
    orderBy: [{ createdAt: "desc" }],
    include: draftWorkOrderInclude,
  });
}

export async function findDraftEstimate(query: string) {
  return db.estimate.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { estimateNumber: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { title: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { notes: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { customer: { displayName: { contains: query, mode: Prisma.QueryMode.insensitive } } },
      ],
    },
    orderBy: [{ createdAt: "desc" }],
    include: draftEstimateInclude,
  });
}

export async function findDraftCase(query: string) {
  return db.case.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { subject: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { description: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { customer: { displayName: { contains: query, mode: Prisma.QueryMode.insensitive } } },
      ],
    },
    orderBy: [{ updatedAt: "desc" }],
    include: draftCaseInclude,
  });
}

export async function findDraftVehicle(query: string) {
  return db.vehicle.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { vin: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { normalizedVin: { contains: query.toUpperCase(), mode: Prisma.QueryMode.insensitive } },
        { make: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { model: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { unitNumber: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { licensePlate: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { customer: { displayName: { contains: query, mode: Prisma.QueryMode.insensitive } } },
      ],
    },
    orderBy: [{ updatedAt: "desc" }],
    include: draftVehicleInclude,
  });
}

export function normalizeWorkOrderNumber(query: string) {
  const match = query.match(/\bWO[-\s]?\d{6}[-\s]?\d{4}\b/i);

  if (!match) {
    return query;
  }

  return match[0].replace(/\s+/g, "-").toUpperCase();
}

export function formatVehicleLabel(vehicle: {
  year?: number | null;
  make?: string | null;
  model?: string | null;
  unitNumber?: string | null;
  licensePlate?: string | null;
}) {
  return (
    [
      vehicle.unitNumber ? `Unit ${vehicle.unitNumber}` : null,
      [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" "),
      vehicle.licensePlate,
    ]
      .filter(Boolean)
      .join(" | ") || "Vehicle"
  );
}

export function formatCustomerGreetingName(customer: {
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
}) {
  return customer.firstName || customer.lastName || customer.displayName || "there";
}

export function formatLineType(lineType: WorkOrderLineType | string) {
  return String(lineType).replaceAll("_", " ").toLowerCase();
}

export function formatMoney(value: number | null | undefined) {
  return value == null ? "TBD" : `$${value.toFixed(2)}`;
}

export function trimSentence(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() || null;
}
