import { Prisma } from "@/generated/prisma/client";
import { notFound } from "@/lib/core/api";
import { db } from "@/lib/db";

export const vendorDetailInclude: Prisma.VendorInclude = {
  contacts: {
    where: { deletedAt: null },
    orderBy: [{ isPrimary: "desc" }, { displayName: "asc" }, { createdAt: "asc" }],
  },
  addresses: {
    where: { deletedAt: null },
    orderBy: [{ isPrimary: "desc" }, { type: "asc" }, { createdAt: "asc" }],
  },
};

export async function findActiveVendor(id: string) {
  const vendor = await db.vendor.findFirst({
    where: { id, deletedAt: null },
    include: vendorDetailInclude,
  });

  if (!vendor) {
    notFound("Vendor was not found.");
  }

  return vendor;
}

export async function ensureActiveVendor(id: string) {
  const vendor = await db.vendor.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, name: true },
  });

  if (!vendor) {
    notFound("Vendor was not found.");
  }

  return vendor;
}
