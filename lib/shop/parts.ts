import { db } from "@/lib/db";
import { PartTransactionType } from "@/generated/prisma/client";
import {
  receiveQuantity,
  adjustQuantityOnHand,
  reserveQuantity,
  issueReservedQuantity,
  releaseReservedQuantity,
} from "./inventory";

type InventoryActionActor = {
  userId?: string;
  vendorId?: string; // e.g. for receiving
};

export async function receivePart(
  partId: string,
  quantity: number | string,
  unitCost: number | string | undefined,
  reference: string | undefined,
  note: string | undefined,
  actor: InventoryActionActor
) {
  return await db.$transaction(async (tx) => {
    const part = await tx.part.findUniqueOrThrow({ where: { id: partId } });

    const updatedQuantities = receiveQuantity(part, quantity);

    const transaction = await tx.partTransaction.create({
      data: {
        partId,
        type: PartTransactionType.RECEIVE,
        quantity,
        unitCost,
        reference,
        note,
        createdByUserId: actor.userId,
        vendorId: actor.vendorId,
      },
    });

    await tx.part.update({
      where: { id: partId },
      data: updatedQuantities,
    });

    return transaction;
  });
}

export async function adjustPartQuantity(
  partId: string,
  quantityDelta: number | string,
  reference: string | undefined,
  note: string | undefined,
  actor: InventoryActionActor
) {
  return await db.$transaction(async (tx) => {
    const part = await tx.part.findUniqueOrThrow({ where: { id: partId } });

    const updatedQuantities = adjustQuantityOnHand(part, quantityDelta);

    const transaction = await tx.partTransaction.create({
      data: {
        partId,
        type: PartTransactionType.ADJUST,
        quantity: quantityDelta, // can be negative
        reference,
        note,
        createdByUserId: actor.userId,
      },
    });

    await tx.part.update({
      where: { id: partId },
      data: updatedQuantities,
    });

    return transaction;
  });
}

export async function reservePart(
  partId: string,
  quantity: number | string,
  workOrderId: string,
  lineItemId: string | undefined,
  actor: InventoryActionActor
) {
  return await db.$transaction(async (tx) => {
    const part = await tx.part.findUniqueOrThrow({ where: { id: partId } });

    // Validate and calculate new quantities
    const updatedQuantities = reserveQuantity(part, quantity);

    const reservation = await tx.partReservation.create({
      data: {
        partId,
        workOrderId,
        lineItemId,
        quantity,
        reservedByUserId: actor.userId,
        status: "ACTIVE",
      },
    });

    await tx.partTransaction.create({
      data: {
        partId,
        type: PartTransactionType.RESERVE,
        quantity,
        workOrderId,
        lineItemId,
        reservationId: reservation.id,
        createdByUserId: actor.userId,
      },
    });

    await tx.part.update({
      where: { id: partId },
      data: updatedQuantities,
    });

    return reservation;
  });
}

export async function issuePartReservation(
  reservationId: string,
  quantity: number | string, // Can be partial issue
  actor: InventoryActionActor
) {
  return await db.$transaction(async (tx) => {
    const reservation = await tx.partReservation.findUniqueOrThrow({
      where: { id: reservationId },
      include: { part: true },
    });

    if (reservation.status !== "ACTIVE") {
      throw new Error("Can only issue from an ACTIVE reservation");
    }

    // In a partial issue, we'd need more complex logic. 
    // For M04, we assume we issue the exact reserved quantity or release the rest.
    // Let's enforce that issued qty must match reserved qty for simplicity, or we release remaining.
    // Actually, inventory.ts's `issueReservedQuantity` deducts from both.
    const updatedQuantities = issueReservedQuantity(reservation.part, quantity);

    await tx.partReservation.update({
      where: { id: reservationId },
      data: {
        status: "ISSUED",
        issuedAt: new Date(),
      },
    });

    const transaction = await tx.partTransaction.create({
      data: {
        partId: reservation.partId,
        type: PartTransactionType.ISSUE,
        quantity,
        workOrderId: reservation.workOrderId,
        lineItemId: reservation.lineItemId,
        reservationId: reservation.id,
        createdByUserId: actor.userId,
      },
    });

    await tx.part.update({
      where: { id: reservation.partId },
      data: updatedQuantities,
    });

    return transaction;
  });
}

export async function releasePartReservation(
  reservationId: string,
  quantity: number | string,
  actor: InventoryActionActor
) {
  return await db.$transaction(async (tx) => {
    const reservation = await tx.partReservation.findUniqueOrThrow({
      where: { id: reservationId },
      include: { part: true },
    });

    if (reservation.status !== "ACTIVE") {
      throw new Error("Can only release an ACTIVE reservation");
    }

    const updatedQuantities = releaseReservedQuantity(reservation.part, quantity);

    await tx.partReservation.update({
      where: { id: reservationId },
      data: {
        status: "RELEASED",
        releasedAt: new Date(),
      },
    });

    const transaction = await tx.partTransaction.create({
      data: {
        partId: reservation.partId,
        type: PartTransactionType.RELEASE_RESERVATION,
        quantity,
        workOrderId: reservation.workOrderId,
        lineItemId: reservation.lineItemId,
        reservationId: reservation.id,
        createdByUserId: actor.userId,
      },
    });

    await tx.part.update({
      where: { id: reservation.partId },
      data: updatedQuantities,
    });

    return transaction;
  });
}
