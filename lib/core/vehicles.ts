import { Prisma } from "@/generated/prisma/client";
import { notFound } from "@/lib/core/api";
import { db } from "@/lib/db";

export const vehicleDetailInclude: Prisma.VehicleInclude = {
  customer: {
    select: {
      id: true,
      displayName: true,
    },
  },
  vehicleNotes: {
    orderBy: [{ createdAt: "desc" }],
    take: 20,
  },
  mileageReadings: {
    orderBy: [{ recordedAt: "desc" }, { createdAt: "desc" }],
    take: 20,
  },
};

export async function ensureActiveCustomer(customerId: string) {
  const customer = await db.customer.findFirst({
    where: {
      id: customerId,
      deletedAt: null,
    },
    select: {
      id: true,
      displayName: true,
    },
  });

  if (!customer) {
    notFound("Customer was not found.");
  }

  return customer;
}

export async function findActiveVehicle(id: string) {
  const vehicle = await db.vehicle.findFirst({
    where: {
      id,
      deletedAt: null,
      customer: {
        deletedAt: null,
      },
    },
    include: vehicleDetailInclude,
  });

  if (!vehicle) {
    notFound("Vehicle was not found.");
  }

  return vehicle;
}
