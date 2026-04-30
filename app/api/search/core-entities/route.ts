import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { requireAuth } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/core/api";
import { db } from "@/lib/db";
import {
  emptySalesSearchPayload,
  searchSalesEntities,
  type SalesSearchResult,
} from "@/lib/sales/search";

type CoreSearchResultType = "customer" | "contact" | "vehicle" | "vendor";

type CoreSearchResult = {
  type: CoreSearchResultType;
  id: string;
  label: string;
  subtitle: string;
  href: string;
  metadata: Record<string, string | number | boolean | null>;
};

type SearchResult = CoreSearchResult | SalesSearchResult;

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);

    const query = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 100);

    if (!query) {
      return NextResponse.json(emptySearchResponse(query));
    }

    const [customers, contacts, vehicles, vendors, sales] = await Promise.all([
      searchCustomers(query),
      searchContacts(query),
      searchVehicles(query),
      searchVendors(query),
      searchSalesEntities(query, user),
    ]);
    const results: SearchResult[] = [...customers, ...contacts, ...vehicles, ...vendors, ...sales.results];

    return NextResponse.json({
      query,
      results,
      counts: {
        customers: customers.length,
        contacts: contacts.length,
        vehicles: vehicles.length,
        vendors: vendors.length,
        leads: sales.counts.leads,
        opportunities: sales.counts.opportunities,
        quotes: sales.counts.quotes,
        cases: sales.counts.cases,
        total: results.length,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

async function searchCustomers(query: string): Promise<CoreSearchResult[]> {
  const customers = await db.customer.findMany({
    where: {
      deletedAt: null,
      OR: [
        { displayName: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { companyName: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { firstName: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { lastName: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { email: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { phone: { contains: query, mode: Prisma.QueryMode.insensitive } },
      ],
    },
    orderBy: [{ displayName: "asc" }],
    take: 10,
  });

  return customers.map((customer) => ({
    type: "customer",
    id: customer.id,
    label: customer.displayName,
    subtitle: joinParts([customer.email, customer.phone, customer.isWalkIn ? "Walk-in" : null]) || "Customer",
    href: `/customers/${customer.id}`,
    metadata: {
      customerType: customer.customerType,
      isWalkIn: customer.isWalkIn,
    },
  }));
}

async function searchContacts(query: string): Promise<CoreSearchResult[]> {
  const contacts = await db.contact.findMany({
    where: {
      deletedAt: null,
      AND: [
        {
          OR: [
            {
              customerId: { not: null },
              vendorId: null,
              customer: { is: { deletedAt: null } },
            },
            {
              vendorId: { not: null },
              customerId: null,
              vendor: { is: { deletedAt: null } },
            },
          ],
        },
        {
          OR: [
            { displayName: { contains: query, mode: Prisma.QueryMode.insensitive } },
            { firstName: { contains: query, mode: Prisma.QueryMode.insensitive } },
            { lastName: { contains: query, mode: Prisma.QueryMode.insensitive } },
            { email: { contains: query, mode: Prisma.QueryMode.insensitive } },
            { phone: { contains: query, mode: Prisma.QueryMode.insensitive } },
            { mobile: { contains: query, mode: Prisma.QueryMode.insensitive } },
          ],
        },
      ],
    },
    include: {
      customer: { select: { id: true, displayName: true } },
      vendor: { select: { id: true, name: true } },
    },
    orderBy: [{ displayName: "asc" }],
    take: 10,
  });

  return contacts.map((contact) => {
    const ownerType = contact.customer ? "customer" : "vendor";
    const ownerId = contact.customer?.id ?? contact.vendor?.id ?? null;
    const ownerName = contact.customer?.displayName ?? contact.vendor?.name ?? "Unknown owner";
    const ownerHref = ownerType === "customer" ? `/customers/${ownerId}` : `/vendors/${ownerId}`;

    return {
      type: "contact",
      id: contact.id,
      label: contact.displayName,
      subtitle: joinParts([ownerName, contact.email, contact.mobile ?? contact.phone]) || "Contact",
      href: ownerHref,
      metadata: {
        ownerType,
        ownerId,
        ownerName,
        isPrimary: contact.isPrimary,
      },
    };
  });
}

async function searchVehicles(query: string): Promise<CoreSearchResult[]> {
  const vehicles = await db.vehicle.findMany({
    where: {
      deletedAt: null,
      customer: { deletedAt: null },
      OR: [
        { vin: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { normalizedVin: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { make: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { model: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { trim: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { unitNumber: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { licensePlate: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { customer: { displayName: { contains: query, mode: Prisma.QueryMode.insensitive } } },
      ],
    },
    include: {
      customer: { select: { id: true, displayName: true } },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 10,
  });

  return vehicles.map((vehicle) => {
    const vehicleName = joinParts([vehicle.year, vehicle.make, vehicle.model, vehicle.trim]);
    const label = vehicleName || vehicle.unitNumber || vehicle.vin || "Vehicle";

    return {
      type: "vehicle",
      id: vehicle.id,
      label,
      subtitle: joinParts([
        vehicle.customer.displayName,
        vehicle.unitNumber ? `Unit ${vehicle.unitNumber}` : null,
        vehicle.licensePlate,
        vehicle.normalizedVin,
      ]),
      href: `/vehicles/${vehicle.id}`,
      metadata: {
        customerId: vehicle.customerId,
        customerName: vehicle.customer.displayName,
        normalizedVin: vehicle.normalizedVin,
        currentMileage: vehicle.currentMileage,
      },
    };
  });
}

async function searchVendors(query: string): Promise<CoreSearchResult[]> {
  const vendors = await db.vendor.findMany({
    where: {
      deletedAt: null,
      OR: [
        { name: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { accountNumber: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { email: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { phone: { contains: query, mode: Prisma.QueryMode.insensitive } },
      ],
    },
    orderBy: [{ name: "asc" }],
    take: 10,
  });

  return vendors.map((vendor) => ({
    type: "vendor",
    id: vendor.id,
    label: vendor.name,
    subtitle: joinParts([vendor.vendorType, vendor.email, vendor.phone]) || "Vendor",
    href: `/vendors/${vendor.id}`,
    metadata: {
      vendorType: vendor.vendorType,
    },
  }));
}

function emptySearchResponse(query: string) {
  const sales = emptySalesSearchPayload();

  return {
    query,
    results: [],
    counts: {
      customers: 0,
      contacts: 0,
      vehicles: 0,
      vendors: 0,
      leads: sales.counts.leads,
      opportunities: sales.counts.opportunities,
      quotes: sales.counts.quotes,
      cases: sales.counts.cases,
      total: 0,
    },
  };
}

function joinParts(parts: Array<string | number | null | undefined>) {
  return parts
    .filter((part) => part !== null && part !== undefined && String(part).trim() !== "")
    .map((part) => String(part))
    .join(" | ");
}
