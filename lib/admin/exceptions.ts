import { subDays } from "date-fns";
import { db } from "@/lib/db";

const STALE_DAYS = 30;
const LIST_LIMIT = 50;

export type ExceptionCounts = {
  customersWithoutContacts: number;
  staleQuotes: number;
  staleEstimates: number;
  expiredPortalTokens: number;
  expiredVideoShareLinks: number;
  openWorkOrdersWithoutTech: number;
  total: number;
};

export async function getExceptionCounts(): Promise<ExceptionCounts> {
  const now = new Date();
  const staleThreshold = subDays(now, STALE_DAYS);

  const [
    customersWithoutContacts,
    staleQuotes,
    staleEstimates,
    expiredPortalTokens,
    expiredVideoShareLinks,
    openWorkOrdersWithoutTech,
  ] = await Promise.all([
    db.customer.count({
      where: {
        deletedAt: null,
        contacts: { none: { deletedAt: null } },
      },
    }),
    db.quote.count({
      where: {
        deletedAt: null,
        status: { in: ["DRAFT", "SENT"] },
        OR: [
          { validUntil: { lt: now } },
          { validUntil: null, createdAt: { lt: staleThreshold } },
        ],
      },
    }),
    db.estimate.count({
      where: {
        deletedAt: null,
        status: { in: ["DRAFT", "SENT"] },
        OR: [
          { validUntil: { lt: now } },
          { validUntil: null, createdAt: { lt: staleThreshold } },
        ],
      },
    }),
    db.portalToken.count({
      where: {
        revokedAt: null,
        expiresAt: { lt: now },
      },
    }),
    db.videoShareLink.count({
      where: {
        deletedAt: null,
        AND: [{ expiresAt: { not: null } }, { expiresAt: { lt: now } }],
      },
    }),
    db.workOrder.count({
      where: {
        deletedAt: null,
        status: { in: ["OPEN", "IN_PROGRESS"] },
        assignedTechUserId: null,
      },
    }),
  ]);

  return {
    customersWithoutContacts,
    staleQuotes,
    staleEstimates,
    expiredPortalTokens,
    expiredVideoShareLinks,
    openWorkOrdersWithoutTech,
    total:
      customersWithoutContacts +
      staleQuotes +
      staleEstimates +
      expiredPortalTokens +
      expiredVideoShareLinks +
      openWorkOrdersWithoutTech,
  };
}

export async function listCustomersWithoutContacts() {
  return db.customer.findMany({
    where: {
      deletedAt: null,
      contacts: { none: { deletedAt: null } },
    },
    select: {
      id: true,
      displayName: true,
      email: true,
      customerType: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: LIST_LIMIT,
  });
}

export async function listStaleQuotes() {
  const now = new Date();
  const staleThreshold = subDays(now, STALE_DAYS);

  return db.quote.findMany({
    where: {
      deletedAt: null,
      status: { in: ["DRAFT", "SENT"] },
      OR: [
        { validUntil: { lt: now } },
        { validUntil: null, createdAt: { lt: staleThreshold } },
      ],
    },
    select: {
      id: true,
      quoteNumber: true,
      status: true,
      total: true,
      validUntil: true,
      createdAt: true,
      customer: { select: { id: true, displayName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: LIST_LIMIT,
  });
}

export async function listStaleEstimates() {
  const now = new Date();
  const staleThreshold = subDays(now, STALE_DAYS);

  return db.estimate.findMany({
    where: {
      deletedAt: null,
      status: { in: ["DRAFT", "SENT"] },
      OR: [
        { validUntil: { lt: now } },
        { validUntil: null, createdAt: { lt: staleThreshold } },
      ],
    },
    select: {
      id: true,
      estimateNumber: true,
      status: true,
      total: true,
      validUntil: true,
      createdAt: true,
      customer: { select: { id: true, displayName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: LIST_LIMIT,
  });
}

export async function listExpiredPortalTokens() {
  const now = new Date();

  return db.portalToken.findMany({
    where: {
      revokedAt: null,
      expiresAt: { lt: now },
    },
    select: {
      id: true,
      expiresAt: true,
      lastUsedAt: true,
      createdAt: true,
      customer: { select: { id: true, displayName: true } },
    },
    orderBy: { expiresAt: "asc" },
    take: LIST_LIMIT,
  });
}

export async function listExpiredVideoShareLinks() {
  const now = new Date();

  return db.videoShareLink.findMany({
    where: {
      deletedAt: null,
      AND: [{ expiresAt: { not: null } }, { expiresAt: { lt: now } }],
    },
    select: {
      id: true,
      expiresAt: true,
      viewCount: true,
      createdAt: true,
      video: { select: { id: true, title: true } },
    },
    orderBy: { expiresAt: "asc" },
    take: LIST_LIMIT,
  });
}

export async function listOpenWorkOrdersWithoutTech() {
  return db.workOrder.findMany({
    where: {
      deletedAt: null,
      status: { in: ["OPEN", "IN_PROGRESS"] },
      assignedTechUserId: null,
    },
    select: {
      id: true,
      workOrderNumber: true,
      title: true,
      status: true,
      priority: true,
      promisedAt: true,
      openedAt: true,
      customer: { select: { id: true, displayName: true } },
    },
    orderBy: [
      { priority: "desc" },
      { promisedAt: "asc" },
      { openedAt: "desc" },
      { id: "desc" },
    ],
    take: LIST_LIMIT,
  });
}
