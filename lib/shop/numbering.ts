import { format } from "date-fns";
import { db } from "@/lib/db";

type ShopNumberPrefix = "WO" | "EST" | "CO";
type ShopNumberField = "workOrderNumber" | "estimateNumber" | "changeOrderNumber";

export function buildShopNumber(prefix: ShopNumberPrefix, date: Date, sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 9999) {
    throw new Error("sequence must be an integer between 1 and 9999.");
  }

  return `${prefix}-${format(date, "yyyyMM")}-${sequence.toString().padStart(4, "0")}`;
}

export function extractShopNumberSequence(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const sequence = Number(value.trim().split("-")[2]);

  return Number.isInteger(sequence) && sequence > 0 ? sequence : null;
}

export async function generateNextWorkOrderNumber(date: Date = new Date()): Promise<string> {
  return generateNextNumber({
    prefix: "WO",
    date,
    field: "workOrderNumber",
    findLast: async (startsWith) => {
      const record = await db.workOrder.findFirst({
        where: { workOrderNumber: { startsWith } },
        orderBy: { workOrderNumber: "desc" },
        select: { workOrderNumber: true },
      });

      return record?.workOrderNumber ?? null;
    },
  });
}

export async function generateNextEstimateNumber(date: Date = new Date()): Promise<string> {
  return generateNextNumber({
    prefix: "EST",
    date,
    field: "estimateNumber",
    findLast: async (startsWith) => {
      const record = await db.estimate.findFirst({
        where: { estimateNumber: { startsWith } },
        orderBy: { estimateNumber: "desc" },
        select: { estimateNumber: true },
      });

      return record?.estimateNumber ?? null;
    },
  });
}

export async function generateNextChangeOrderNumber(date: Date = new Date()): Promise<string> {
  return generateNextNumber({
    prefix: "CO",
    date,
    field: "changeOrderNumber",
    findLast: async (startsWith) => {
      const record = await db.changeOrder.findFirst({
        where: { changeOrderNumber: { startsWith } },
        orderBy: { changeOrderNumber: "desc" },
        select: { changeOrderNumber: true },
      });

      return record?.changeOrderNumber ?? null;
    },
  });
}

export async function withWorkOrderNumberRetry<T>(
  operation: (nextNumber: string) => Promise<T>,
  maxRetries = 5,
): Promise<T> {
  return withShopNumberRetry("workOrderNumber", generateNextWorkOrderNumber, operation, maxRetries);
}

export async function withEstimateNumberRetry<T>(
  operation: (nextNumber: string) => Promise<T>,
  maxRetries = 5,
): Promise<T> {
  return withShopNumberRetry("estimateNumber", generateNextEstimateNumber, operation, maxRetries);
}

export async function withChangeOrderNumberRetry<T>(
  operation: (nextNumber: string) => Promise<T>,
  maxRetries = 5,
): Promise<T> {
  return withShopNumberRetry("changeOrderNumber", generateNextChangeOrderNumber, operation, maxRetries);
}

async function generateNextNumber({
  prefix,
  date,
  field,
  findLast,
}: {
  prefix: ShopNumberPrefix;
  date: Date;
  field: ShopNumberField;
  findLast: (startsWith: string) => Promise<string | null>;
}): Promise<string> {
  const monthPrefix = `${prefix}-${format(date, "yyyyMM")}`;
  const lastNumber = await findLast(monthPrefix);
  const lastSequence = extractShopNumberSequence(lastNumber) ?? 0;
  const nextSequence = lastSequence + 1;

  if (nextSequence > 9999) {
    throw new Error(`${field} sequence exhausted for ${monthPrefix}.`);
  }

  return buildShopNumber(prefix, date, nextSequence);
}

async function withShopNumberRetry<T>(
  field: ShopNumberField,
  generator: () => Promise<string>,
  operation: (nextNumber: string) => Promise<T>,
  maxRetries: number,
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    const nextNumber = await generator();

    try {
      return await operation(nextNumber);
    } catch (error) {
      if (isUniqueConstraintFor(error, field) && attempt < maxRetries - 1) {
        continue;
      }

      throw error;
    }
  }

  throw new Error(`Unable to generate a unique ${field} after multiple attempts.`);
}

function isUniqueConstraintFor(error: unknown, field: ShopNumberField): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybePrismaError = error as { code?: unknown; meta?: { target?: unknown } };

  if (maybePrismaError.code !== "P2002") {
    return false;
  }

  const target = maybePrismaError.meta?.target;

  return Array.isArray(target) ? target.includes(field) : target === field;
}
