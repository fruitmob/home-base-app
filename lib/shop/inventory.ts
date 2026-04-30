import {
  PartTransactionType,
  type PartTransactionType as PartTransactionTypeValue,
} from "@/generated/prisma/client";
import { round, toNumber } from "@/lib/core/money";

type DecimalLike = { toNumber(): number } | number | string | null | undefined;

export type PartQuantitySnapshot = {
  quantityOnHand: DecimalLike;
  quantityReserved: DecimalLike;
  reorderPoint?: DecimalLike;
};

export type NormalizedPartQuantities = {
  quantityOnHand: number;
  quantityReserved: number;
};

export function availableQuantity(part: PartQuantitySnapshot): number {
  return round(toNumber(part.quantityOnHand) - toNumber(part.quantityReserved));
}

export function isLowStock(part: PartQuantitySnapshot): boolean {
  return availableQuantity(part) <= toNumber(part.reorderPoint);
}

export function canReserveQuantity(part: PartQuantitySnapshot, quantity: DecimalLike): boolean {
  const requested = toNumber(quantity);

  return requested > 0 && availableQuantity(part) >= requested;
}

export function reserveQuantity(
  part: PartQuantitySnapshot,
  quantity: DecimalLike,
): NormalizedPartQuantities {
  const requested = requirePositiveQuantity(quantity, "quantity");

  if (!canReserveQuantity(part, requested)) {
    throw new Error("Requested quantity exceeds available stock.");
  }

  return normalizePartQuantities({
    quantityOnHand: part.quantityOnHand,
    quantityReserved: toNumber(part.quantityReserved) + requested,
  });
}

export function releaseReservedQuantity(
  part: PartQuantitySnapshot,
  quantity: DecimalLike,
): NormalizedPartQuantities {
  const released = requirePositiveQuantity(quantity, "quantity");
  const currentReserved = toNumber(part.quantityReserved);

  if (released > currentReserved) {
    throw new Error("Released quantity exceeds reserved stock.");
  }

  return normalizePartQuantities({
    quantityOnHand: part.quantityOnHand,
    quantityReserved: currentReserved - released,
  });
}

export function issueReservedQuantity(
  part: PartQuantitySnapshot,
  quantity: DecimalLike,
): NormalizedPartQuantities {
  const issued = requirePositiveQuantity(quantity, "quantity");
  const currentOnHand = toNumber(part.quantityOnHand);
  const currentReserved = toNumber(part.quantityReserved);

  if (issued > currentReserved) {
    throw new Error("Issued quantity exceeds reserved stock.");
  }

  return normalizePartQuantities({
    quantityOnHand: currentOnHand - issued,
    quantityReserved: currentReserved - issued,
  });
}

export function receiveQuantity(
  part: PartQuantitySnapshot,
  quantity: DecimalLike,
): NormalizedPartQuantities {
  const received = requirePositiveQuantity(quantity, "quantity");

  return normalizePartQuantities({
    quantityOnHand: toNumber(part.quantityOnHand) + received,
    quantityReserved: part.quantityReserved,
  });
}

export function adjustQuantityOnHand(
  part: PartQuantitySnapshot,
  quantityDelta: DecimalLike,
): NormalizedPartQuantities {
  const next = toNumber(part.quantityOnHand) + toNumber(quantityDelta);

  if (next < 0) {
    throw new Error("Adjustment would make quantity on hand negative.");
  }

  if (next < toNumber(part.quantityReserved)) {
    throw new Error("Adjustment would leave reserved stock above quantity on hand.");
  }

  return normalizePartQuantities({
    quantityOnHand: next,
    quantityReserved: part.quantityReserved,
  });
}

export function transactionAffectsOnHand(type: PartTransactionTypeValue): boolean {
  switch (type) {
    case PartTransactionType.RECEIVE:
    case PartTransactionType.ADJUST:
    case PartTransactionType.ISSUE:
    case PartTransactionType.RETURN_TO_STOCK:
      return true;
    case PartTransactionType.RESERVE:
    case PartTransactionType.RELEASE_RESERVATION:
      return false;
  }
}

function normalizePartQuantities(part: PartQuantitySnapshot): NormalizedPartQuantities {
  const quantityOnHand = round(part.quantityOnHand);
  const quantityReserved = round(part.quantityReserved);

  if (quantityOnHand < 0 || quantityReserved < 0 || quantityReserved > quantityOnHand) {
    throw new Error("Part quantities must be non-negative and reserved stock cannot exceed on-hand stock.");
  }

  return { quantityOnHand, quantityReserved };
}

function requirePositiveQuantity(value: DecimalLike, field: string): number {
  const parsed = toNumber(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${field} must be greater than zero.`);
  }

  return parsed;
}
