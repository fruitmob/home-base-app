import { format } from "date-fns";
import { db } from "@/lib/db";

/**
 * Predicts the next quote number based on current maximum in the database
 * for the current month. Format: Q-YYYYMM-####
 */
export async function generateNextQuoteNumber(date: Date = new Date()): Promise<string> {
  const prefix = `Q-${format(date, "yyyyMM")}`;

  const lastQuote = await db.quote.findFirst({
    where: {
      quoteNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      quoteNumber: "desc",
    },
    select: {
      quoteNumber: true,
    },
  });

  if (!lastQuote) {
    return `${prefix}-0001`;
  }

  const parts = lastQuote.quoteNumber.split("-");
  const lastCounterStr = parts[2];
  if (!lastCounterStr) {
    return `${prefix}-0001`;
  }

  const lastCounter = parseInt(lastCounterStr, 10);
  if (isNaN(lastCounter)) {
    return `${prefix}-0001`;
  }

  const nextCounter = lastCounter + 1;
  const paddedCounter = nextCounter.toString().padStart(4, "0");

  return `${prefix}-${paddedCounter}`;
}

/**
 * Wraps a quote creation function with retry logic to handle quoteNumber collisions.
 * The operation must throw if the unique constraint on quoteNumber fails.
 * With Prisma, a unique constraint failure is a PrismaClientKnownRequestError with code P2002.
 */
export async function withQuoteNumberRetry<T>(
  operation: (nextQuoteNumber: string) => Promise<T>,
  maxRetries = 5,
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const nextNumber = await generateNextQuoteNumber();
    try {
      return await operation(nextNumber);
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const error = err as any;
      // Prisma P2002 is Unique constraint failed
      if (error?.code === "P2002" && error?.meta?.target?.includes("quoteNumber")) {
        if (attempt === maxRetries - 1) {
          throw new Error("Unable to generate a unique quote number after multiple attempts. Please try again.");
        }
        // Collision happened, loop will retry and generate next number.
        continue;
      }
      // Re-throw any other error
      throw error;
    }
  }
  throw new Error("Failed to generate quote number.");
}
