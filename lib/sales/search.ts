import { Prisma, Role } from "@/generated/prisma/client";
import type { CurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export type SalesSearchResultType = "lead" | "opportunity" | "quote" | "case";

export type SalesSearchResult = {
  type: SalesSearchResultType;
  id: string;
  label: string;
  subtitle: string;
  href: string;
  metadata: Record<string, string | number | boolean | null>;
};

export type SalesSearchPayload = {
  results: SalesSearchResult[];
  counts: {
    leads: number;
    opportunities: number;
    quotes: number;
    cases: number;
    total: number;
  };
};

export async function searchSalesEntities(query: string, user: CurrentUser): Promise<SalesSearchPayload> {
  const [leads, opportunities, quotes, cases] = await Promise.all([
    searchLeads(query, user),
    searchOpportunities(query, user),
    searchQuotes(query),
    searchCases(query),
  ]);
  const results = [...leads, ...opportunities, ...quotes, ...cases];

  return {
    results,
    counts: {
      leads: leads.length,
      opportunities: opportunities.length,
      quotes: quotes.length,
      cases: cases.length,
      total: results.length,
    },
  };
}

export function emptySalesSearchPayload(): SalesSearchPayload {
  return {
    results: [],
    counts: {
      leads: 0,
      opportunities: 0,
      quotes: 0,
      cases: 0,
      total: 0,
    },
  };
}

async function searchLeads(query: string, user: CurrentUser): Promise<SalesSearchResult[]> {
  const whereAnd: Prisma.LeadWhereInput[] = [
    { deletedAt: null },
    {
      OR: [
        { displayName: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { companyName: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { firstName: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { lastName: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { email: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { phone: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { interest: { contains: query, mode: Prisma.QueryMode.insensitive } },
      ],
    },
  ];

  if (user.role === Role.SALES_REP) {
    whereAnd.push({ OR: [{ ownerUserId: user.id }, { ownerUserId: null }] });
  }

  const leads = await db.lead.findMany({
    where: { AND: whereAnd },
    include: {
      ownerUser: { select: { id: true, email: true } },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 10,
  });

  return leads.map((lead) => ({
    type: "lead",
    id: lead.id,
    label: lead.displayName,
    subtitle: joinParts([lead.status, lead.email, lead.phone, lead.ownerUser?.email]) || "Lead",
    href: `/sales/leads/${lead.id}`,
    metadata: {
      status: lead.status,
      source: lead.source,
      ownerUserId: lead.ownerUserId,
    },
  }));
}

async function searchOpportunities(query: string, user: CurrentUser): Promise<SalesSearchResult[]> {
  const whereAnd: Prisma.OpportunityWhereInput[] = [
    { deletedAt: null },
    {
      OR: [
        { name: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { notes: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { customer: { displayName: { contains: query, mode: Prisma.QueryMode.insensitive } } },
      ],
    },
  ];

  if (user.role === Role.SALES_REP) {
    whereAnd.push({ OR: [{ ownerUserId: user.id }, { ownerUserId: null }] });
  }

  const opportunities = await db.opportunity.findMany({
    where: { AND: whereAnd },
    include: {
      customer: { select: { id: true, displayName: true } },
      ownerUser: { select: { id: true, email: true } },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 10,
  });

  return opportunities.map((opportunity) => ({
    type: "opportunity",
    id: opportunity.id,
    label: opportunity.name,
    subtitle: joinParts([
      opportunity.customer.displayName,
      opportunity.stage,
      Number(opportunity.amount) > 0 ? `$${Number(opportunity.amount).toFixed(2)}` : null,
      opportunity.ownerUser?.email,
    ]) || "Opportunity",
    href: `/sales/opportunities/${opportunity.id}`,
    metadata: {
      customerId: opportunity.customerId,
      customerName: opportunity.customer.displayName,
      stage: opportunity.stage,
      ownerUserId: opportunity.ownerUserId,
    },
  }));
}

async function searchQuotes(query: string): Promise<SalesSearchResult[]> {
  const quotes = await db.quote.findMany({
    where: {
      deletedAt: null,
      OR: [
        { quoteNumber: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { notes: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { customer: { displayName: { contains: query, mode: Prisma.QueryMode.insensitive } } },
      ],
    },
    include: {
      customer: { select: { id: true, displayName: true } },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 10,
  });

  return quotes.map((quote) => ({
    type: "quote",
    id: quote.id,
    label: quote.quoteNumber,
    subtitle: joinParts([quote.customer.displayName, quote.status, `$${Number(quote.total).toFixed(2)}`]) || "Quote",
    href: `/quotes/${quote.id}`,
    metadata: {
      customerId: quote.customerId,
      customerName: quote.customer.displayName,
      status: quote.status,
      total: Number(quote.total),
    },
  }));
}

async function searchCases(query: string): Promise<SalesSearchResult[]> {
  const cases = await db.case.findMany({
    where: {
      deletedAt: null,
      OR: [
        { subject: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { description: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { customer: { displayName: { contains: query, mode: Prisma.QueryMode.insensitive } } },
      ],
    },
    include: {
      customer: { select: { id: true, displayName: true } },
      assignedUser: { select: { id: true, email: true } },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 10,
  });

  return cases.map((supportCase) => ({
    type: "case",
    id: supportCase.id,
    label: supportCase.subject,
    subtitle: joinParts([
      supportCase.customer.displayName,
      supportCase.status,
      supportCase.priority,
      supportCase.assignedUser?.email,
    ]) || "Case",
    href: `/cases/${supportCase.id}`,
    metadata: {
      customerId: supportCase.customerId,
      customerName: supportCase.customer.displayName,
      status: supportCase.status,
      priority: supportCase.priority,
      assignedUserId: supportCase.assignedUserId,
    },
  }));
}

function joinParts(parts: Array<string | number | null | undefined>) {
  return parts
    .filter((part) => part !== null && part !== undefined && String(part).trim() !== "")
    .map((part) => String(part))
    .join(" | ");
}
