import { toNumber } from "@/lib/core/money";
import { db } from "@/lib/db";

export type ResolvedPrice = {
  productId: string;
  unitPrice: number;
  source: "pricebook_entry" | "product_default";
  pricebookId: string | null;
  pricebookEntryId: string | null;
};

type ResolveOptions = {
  customerId?: string | null;
  pricebookId?: string | null;
  asOf?: Date;
};

export async function resolvePrice(
  productId: string,
  options: ResolveOptions = {},
): Promise<ResolvedPrice> {
  const product = await db.product.findFirst({
    where: { id: productId, deletedAt: null },
    select: { id: true, defaultUnitPrice: true },
  });

  if (!product) {
    throw new Error(`Product ${productId} was not found.`);
  }

  const pricebookId = await resolvePricebookId(options);

  if (pricebookId) {
    const entry = await findEffectiveEntry(pricebookId, productId, options.asOf ?? new Date());

    if (entry) {
      return {
        productId: product.id,
        unitPrice: toNumber(entry.unitPrice),
        source: "pricebook_entry",
        pricebookId,
        pricebookEntryId: entry.id,
      };
    }
  }

  return {
    productId: product.id,
    unitPrice: toNumber(product.defaultUnitPrice),
    source: "product_default",
    pricebookId,
    pricebookEntryId: null,
  };
}

async function resolvePricebookId(options: ResolveOptions): Promise<string | null> {
  if (options.pricebookId) {
    const explicit = await db.pricebook.findFirst({
      where: { id: options.pricebookId, deletedAt: null, active: true },
      select: { id: true },
    });

    if (explicit) {
      return explicit.id;
    }
  }

  if (options.customerId) {
    const customer = await db.customer.findFirst({
      where: { id: options.customerId, deletedAt: null },
      select: { defaultPricebookId: true },
    });

    if (customer?.defaultPricebookId) {
      const customerBook = await db.pricebook.findFirst({
        where: { id: customer.defaultPricebookId, deletedAt: null, active: true },
        select: { id: true },
      });

      if (customerBook) {
        return customerBook.id;
      }
    }
  }

  const fallback = await db.pricebook.findFirst({
    where: { isDefault: true, deletedAt: null, active: true },
    select: { id: true },
  });

  return fallback?.id ?? null;
}

async function findEffectiveEntry(pricebookId: string, productId: string, asOf: Date) {
  return db.pricebookEntry.findFirst({
    where: {
      pricebookId,
      productId,
      deletedAt: null,
      AND: [
        { OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: asOf } }] },
        { OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }] },
      ],
    },
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    select: { id: true, unitPrice: true },
  });
}
