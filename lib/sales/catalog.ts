import { Prisma } from "@/generated/prisma/client";
import { notFound } from "@/lib/core/api";
import { db } from "@/lib/db";

export const pricebookDetailInclude: Prisma.PricebookInclude = {
  entries: {
    where: { deletedAt: null },
    include: {
      product: {
        select: { id: true, sku: true, name: true, active: true, deletedAt: true },
      },
    },
    orderBy: [{ createdAt: "asc" }],
  },
};

export async function findActiveProduct(id: string) {
  const product = await db.product.findFirst({ where: { id, deletedAt: null } });

  if (!product) {
    notFound("Product was not found.");
  }

  return product;
}

export async function ensureActiveProduct(id: string) {
  const product = await db.product.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, sku: true, name: true, defaultUnitPrice: true, taxable: true },
  });

  if (!product) {
    notFound("Product was not found.");
  }

  return product;
}

export async function findActivePricebook(id: string) {
  const pricebook = await db.pricebook.findFirst({
    where: { id, deletedAt: null },
    include: pricebookDetailInclude,
  });

  if (!pricebook) {
    notFound("Pricebook was not found.");
  }

  return pricebook;
}

export async function ensureActivePricebook(id: string) {
  const pricebook = await db.pricebook.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, name: true, isDefault: true, active: true },
  });

  if (!pricebook) {
    notFound("Pricebook was not found.");
  }

  return pricebook;
}

export async function findActivePricebookEntry(id: string) {
  const entry = await db.pricebookEntry.findFirst({
    where: { id, deletedAt: null },
    include: {
      pricebook: { select: { id: true, name: true, isDefault: true, deletedAt: true } },
      product: { select: { id: true, sku: true, name: true } },
    },
  });

  if (!entry) {
    notFound("Pricebook entry was not found.");
  }

  return entry;
}
