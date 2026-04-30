import {
  GaugeRetrievalSourceType,
  KbArticleStatus,
  Prisma,
  Role,
} from "@/generated/prisma/client";
import type { CurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

type RetrievalSearchRow = {
  id: string;
  sourceType: string;
  sourceId: string;
  title: string;
  summary: string | null;
  href: string | null;
  metadata: Prisma.JsonValue | null;
  sourceUpdatedAt: Date | null;
  indexedAt: Date;
  rank: number | string;
};

export type GaugeRetrievalHit = {
  id: string;
  sourceType: GaugeRetrievalSourceType;
  sourceId: string;
  title: string;
  summary: string | null;
  href: string | null;
  metadata: Record<string, unknown>;
  sourceUpdatedAt: string | null;
  indexedAt: string;
  rank: number;
};

const MAX_QUERY_LENGTH = 120;

const retrievalSearchVector = Prisma.sql`
  to_tsvector(
    'simple',
    coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(content, '')
  )
`;

export async function searchGaugeRetrievalSource({
  sourceType,
  query,
  user,
  limit = 5,
}: {
  sourceType: GaugeRetrievalSourceType;
  query: string;
  user: CurrentUser;
  limit?: number;
}): Promise<GaugeRetrievalHit[]> {
  const cleanQuery = query.trim().slice(0, MAX_QUERY_LENGTH);

  if (!cleanQuery) {
    return [];
  }

  await syncGaugeRetrievalSource(sourceType);

  const visibilityFilter = kbVisibilityFilter(sourceType, user.role);
  const tsQuery = Prisma.sql`websearch_to_tsquery('simple', ${cleanQuery})`;

  const rankedResults = await db.$queryRaw<RetrievalSearchRow[]>(Prisma.sql`
    SELECT
      id,
      "sourceType"::text AS "sourceType",
      "sourceId",
      title,
      summary,
      href,
      metadata,
      "sourceUpdatedAt",
      "indexedAt",
      ts_rank_cd(${retrievalSearchVector}, ${tsQuery}) AS rank
    FROM "GaugeRetrievalIndex"
    WHERE "sourceType"::text = ${sourceType}
      ${visibilityFilter}
      AND ${retrievalSearchVector} @@ ${tsQuery}
    ORDER BY rank DESC, "sourceUpdatedAt" DESC NULLS LAST, title ASC
    LIMIT ${Math.max(1, Math.min(limit, 10))}
  `);

  if (rankedResults.length > 0) {
    return rankedResults.map(normalizeRetrievalSearchRow);
  }

  const likeQuery = `%${cleanQuery}%`;
  const fallbackResults = await db.$queryRaw<RetrievalSearchRow[]>(Prisma.sql`
    SELECT
      id,
      "sourceType"::text AS "sourceType",
      "sourceId",
      title,
      summary,
      href,
      metadata,
      "sourceUpdatedAt",
      "indexedAt",
      0::double precision AS rank
    FROM "GaugeRetrievalIndex"
    WHERE "sourceType"::text = ${sourceType}
      ${visibilityFilter}
      AND (
        title ILIKE ${likeQuery}
        OR coalesce(summary, '') ILIKE ${likeQuery}
        OR content ILIKE ${likeQuery}
      )
    ORDER BY "sourceUpdatedAt" DESC NULLS LAST, title ASC
    LIMIT ${Math.max(1, Math.min(limit, 10))}
  `);

  if (fallbackResults.length > 0) {
    return fallbackResults.map(normalizeRetrievalSearchRow);
  }

  const tokenResults = await searchByFallbackTokens({
    sourceType,
    query: cleanQuery,
    visibilityFilter,
    limit,
  });

  return tokenResults.map(normalizeRetrievalSearchRow);
}

export async function syncGaugeRetrievalSource(sourceType: GaugeRetrievalSourceType) {
  const builder = retrievalDocumentBuilders[sourceType];
  const documents = await builder();

  await db.$transaction(async (tx) => {
    await tx.gaugeRetrievalIndex.deleteMany({ where: { sourceType } });

    if (documents.length > 0) {
      await tx.gaugeRetrievalIndex.createMany({ data: documents });
    }
  });
}

const retrievalDocumentBuilders: Record<
  GaugeRetrievalSourceType,
  () => Promise<Prisma.GaugeRetrievalIndexCreateManyInput[]>
> = {
  [GaugeRetrievalSourceType.CUSTOMER]: buildCustomerDocuments,
  [GaugeRetrievalSourceType.VEHICLE]: buildVehicleDocuments,
  [GaugeRetrievalSourceType.PART]: buildPartDocuments,
  [GaugeRetrievalSourceType.ESTIMATE]: buildEstimateDocuments,
  [GaugeRetrievalSourceType.CASE]: buildCaseDocuments,
  [GaugeRetrievalSourceType.KB_ARTICLE]: buildKbArticleDocuments,
  [GaugeRetrievalSourceType.VIDEO]: buildVideoDocuments,
};

async function buildCustomerDocuments(): Promise<Prisma.GaugeRetrievalIndexCreateManyInput[]> {
  const customers = await db.customer.findMany({
    where: { deletedAt: null },
    orderBy: [{ updatedAt: "desc" }],
    include: {
      contacts: {
        where: { deletedAt: null },
        orderBy: [{ isPrimary: "desc" }, { displayName: "asc" }],
        take: 3,
        select: {
          displayName: true,
          email: true,
          phone: true,
          mobile: true,
        },
      },
      vehicles: {
        where: { deletedAt: null },
        orderBy: [{ updatedAt: "desc" }],
        take: 4,
        select: {
          id: true,
          year: true,
          make: true,
          model: true,
          unitNumber: true,
          licensePlate: true,
          currentMileage: true,
        },
      },
      workOrders: {
        where: { deletedAt: null },
        orderBy: [{ createdAt: "desc" }],
        take: 3,
        select: {
          id: true,
          workOrderNumber: true,
          title: true,
          status: true,
          priority: true,
          promisedAt: true,
        },
      },
      cases: {
        where: { deletedAt: null },
        orderBy: [{ updatedAt: "desc" }],
        take: 3,
        select: {
          id: true,
          subject: true,
          status: true,
          priority: true,
        },
      },
      estimates: {
        where: { deletedAt: null },
        orderBy: [{ createdAt: "desc" }],
        take: 3,
        select: {
          id: true,
          estimateNumber: true,
          title: true,
          status: true,
          total: true,
        },
      },
    },
  });

  return customers.map((customer) => {
    const recentVehicles = customer.vehicles.map((vehicle) => ({
      id: vehicle.id,
      label: formatVehicleLabel(vehicle),
      currentMileage: vehicle.currentMileage,
      licensePlate: vehicle.licensePlate,
    }));
    const recentWorkOrders = customer.workOrders.map((workOrder) => ({
      id: workOrder.id,
      workOrderNumber: workOrder.workOrderNumber,
      title: workOrder.title,
      status: workOrder.status,
      priority: workOrder.priority,
      promisedAt: toIso(workOrder.promisedAt),
    }));
    const recentCases = customer.cases.map((supportCase) => ({
      id: supportCase.id,
      subject: supportCase.subject,
      status: supportCase.status,
      priority: supportCase.priority,
    }));
    const recentEstimates = customer.estimates.map((estimate) => ({
      id: estimate.id,
      estimateNumber: estimate.estimateNumber,
      title: estimate.title,
      status: estimate.status,
      total: Number(estimate.total),
    }));

    return {
      sourceType: GaugeRetrievalSourceType.CUSTOMER,
      sourceId: customer.id,
      title: customer.displayName,
      summary: joinText([
        customer.email,
        customer.phone,
        customer.customerType,
        customer.isWalkIn ? "Walk-in" : null,
      ]),
      content: buildSearchContent([
        customer.displayName,
        customer.companyName,
        customer.firstName,
        customer.lastName,
        customer.email,
        customer.phone,
        customer.notes,
        ...customer.contacts.flatMap((contact) => [
          contact.displayName,
          contact.email,
          contact.phone,
          contact.mobile,
        ]),
        ...customer.vehicles.flatMap((vehicle) => [
          formatVehicleLabel(vehicle),
          vehicle.unitNumber,
          vehicle.licensePlate,
          vehicle.currentMileage,
        ]),
        ...customer.workOrders.flatMap((workOrder) => [
          workOrder.workOrderNumber,
          workOrder.title,
          workOrder.status,
          workOrder.priority,
        ]),
        ...customer.cases.flatMap((supportCase) => [
          supportCase.subject,
          supportCase.status,
          supportCase.priority,
        ]),
        ...customer.estimates.flatMap((estimate) => [
          estimate.estimateNumber,
          estimate.title,
          estimate.status,
          Number(estimate.total).toFixed(2),
        ]),
      ]),
      href: `/customers/${customer.id}`,
      metadata: jsonValue({
        customerType: customer.customerType,
        email: customer.email,
        phone: customer.phone,
        isWalkIn: customer.isWalkIn,
        notes: collapseWhitespace(customer.notes),
        contacts: customer.contacts.map((contact) => ({
          displayName: contact.displayName,
          email: contact.email,
          phone: contact.mobile ?? contact.phone,
        })),
        recentVehicles,
        recentWorkOrders,
        recentCases,
        recentEstimates,
      }),
      sourceUpdatedAt: customer.updatedAt,
    };
  });
}

async function buildVehicleDocuments(): Promise<Prisma.GaugeRetrievalIndexCreateManyInput[]> {
  const vehicles = await db.vehicle.findMany({
    where: {
      deletedAt: null,
      customer: { deletedAt: null },
    },
    orderBy: [{ updatedAt: "desc" }],
    include: {
      customer: { select: { id: true, displayName: true } },
      workOrders: {
        where: { deletedAt: null },
        orderBy: [{ createdAt: "desc" }],
        take: 4,
        select: {
          id: true,
          workOrderNumber: true,
          title: true,
          status: true,
          priority: true,
          createdAt: true,
        },
      },
      mileageReadings: {
        orderBy: [{ recordedAt: "desc" }, { createdAt: "desc" }],
        take: 4,
        select: {
          value: true,
          source: true,
          note: true,
          recordedAt: true,
        },
      },
      vehicleNotes: {
        orderBy: [{ createdAt: "desc" }],
        take: 4,
        select: {
          type: true,
          body: true,
          createdAt: true,
        },
      },
      videos: {
        where: { deletedAt: null },
        orderBy: [{ createdAt: "desc" }],
        take: 3,
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
        },
      },
    },
  });

  return vehicles.map((vehicle) => {
    const vehicleLabel = formatVehicleLabel(vehicle);

    return {
      sourceType: GaugeRetrievalSourceType.VEHICLE,
      sourceId: vehicle.id,
      title: vehicleLabel,
      summary: joinText([
        vehicle.customer.displayName,
        vehicle.unitNumber ? `Unit ${vehicle.unitNumber}` : null,
        vehicle.licensePlate,
        vehicle.normalizedVin,
      ]),
      content: buildSearchContent([
        vehicle.customer.displayName,
        vehicle.vin,
        vehicle.normalizedVin,
        vehicle.make,
        vehicle.model,
        vehicle.trim,
        vehicle.unitNumber,
        vehicle.licensePlate,
        vehicle.color,
        vehicle.notes,
        vehicle.currentMileage,
        ...vehicle.workOrders.flatMap((workOrder) => [
          workOrder.workOrderNumber,
          workOrder.title,
          workOrder.status,
          workOrder.priority,
        ]),
        ...vehicle.mileageReadings.flatMap((reading) => [
          reading.value,
          reading.source,
          reading.note,
        ]),
        ...vehicle.vehicleNotes.flatMap((note) => [note.type, note.body]),
        ...vehicle.videos.flatMap((video) => [video.title, video.status]),
      ]),
      href: `/vehicles/${vehicle.id}`,
      metadata: jsonValue({
        customerId: vehicle.customer.id,
        customerName: vehicle.customer.displayName,
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        trim: vehicle.trim,
        unitNumber: vehicle.unitNumber,
        normalizedVin: vehicle.normalizedVin,
        licensePlate: vehicle.licensePlate,
        currentMileage: vehicle.currentMileage,
        notes: collapseWhitespace(vehicle.notes),
        recentWorkOrders: vehicle.workOrders.map((workOrder) => ({
          id: workOrder.id,
          workOrderNumber: workOrder.workOrderNumber,
          title: workOrder.title,
          status: workOrder.status,
          priority: workOrder.priority,
          createdAt: toIso(workOrder.createdAt),
        })),
        recentMileageReadings: vehicle.mileageReadings.map((reading) => ({
          value: reading.value,
          source: reading.source,
          note: collapseWhitespace(reading.note),
          recordedAt: toIso(reading.recordedAt),
        })),
        recentNotes: vehicle.vehicleNotes.map((note) => ({
          type: note.type,
          body: clipText(note.body, 180),
          createdAt: toIso(note.createdAt),
        })),
        recentVideos: vehicle.videos.map((video) => ({
          id: video.id,
          title: video.title,
          status: video.status,
          createdAt: toIso(video.createdAt),
        })),
      }),
      sourceUpdatedAt: vehicle.updatedAt,
    };
  });
}

async function buildPartDocuments(): Promise<Prisma.GaugeRetrievalIndexCreateManyInput[]> {
  const parts = await db.part.findMany({
    where: { deletedAt: null },
    orderBy: [{ updatedAt: "desc" }],
    include: {
      category: { select: { id: true, name: true } },
      vendor: { select: { id: true, name: true } },
    },
  });

  return parts.map((part) => {
    const quantityOnHand = Number(part.quantityOnHand);
    const quantityReserved = Number(part.quantityReserved);
    const quantityAvailable = quantityOnHand - quantityReserved;
    const reorderPoint = Number(part.reorderPoint);

    return {
      sourceType: GaugeRetrievalSourceType.PART,
      sourceId: part.id,
      title: `${part.sku} - ${part.name}`,
      summary: joinText([
        part.vendor?.name,
        part.binLocation,
        `Available ${quantityAvailable.toFixed(2)} ${part.unitOfMeasure}`,
      ]),
      content: buildSearchContent([
        part.sku,
        part.name,
        part.description,
        part.manufacturer,
        part.manufacturerPartNumber,
        part.binLocation,
        part.unitOfMeasure,
        part.vendor?.name,
        part.category?.name,
      ]),
      href: `/parts/${part.id}`,
      metadata: jsonValue({
        sku: part.sku,
        name: part.name,
        description: collapseWhitespace(part.description),
        manufacturer: part.manufacturer,
        manufacturerPartNumber: part.manufacturerPartNumber,
        binLocation: part.binLocation,
        unitOfMeasure: part.unitOfMeasure,
        vendorName: part.vendor?.name ?? null,
        categoryName: part.category?.name ?? null,
        unitCost: Number(part.unitCost),
        quantityOnHand,
        quantityReserved,
        quantityAvailable,
        reorderPoint,
        active: part.active,
        belowReorderPoint: quantityAvailable <= reorderPoint,
      }),
      sourceUpdatedAt: part.updatedAt,
    };
  });
}

async function buildEstimateDocuments(): Promise<Prisma.GaugeRetrievalIndexCreateManyInput[]> {
  const estimates = await db.estimate.findMany({
    where: { deletedAt: null },
    orderBy: [{ updatedAt: "desc" }],
    include: {
      customer: { select: { id: true, displayName: true } },
      vehicle: {
        select: {
          id: true,
          year: true,
          make: true,
          model: true,
          unitNumber: true,
          licensePlate: true,
        },
      },
      convertedWorkOrder: {
        select: {
          id: true,
          workOrderNumber: true,
        },
      },
    },
  });

  return estimates.map((estimate) => ({
    sourceType: GaugeRetrievalSourceType.ESTIMATE,
    sourceId: estimate.id,
    title: `${estimate.estimateNumber} - ${estimate.title}`,
    summary: joinText([
      estimate.customer.displayName,
      estimate.status,
      `$${Number(estimate.total).toFixed(2)}`,
    ]),
    content: buildSearchContent([
      estimate.estimateNumber,
      estimate.title,
      estimate.notes,
      estimate.status,
      estimate.customer.displayName,
      estimate.vehicle ? formatVehicleLabel(estimate.vehicle) : null,
      estimate.convertedWorkOrder?.workOrderNumber,
    ]),
    href: `/estimates/${estimate.id}`,
    metadata: jsonValue({
      estimateNumber: estimate.estimateNumber,
      title: estimate.title,
      status: estimate.status,
      total: Number(estimate.total),
      subtotal: Number(estimate.subtotal),
      taxTotal: Number(estimate.taxTotal),
      validUntil: toIso(estimate.validUntil),
      sentAt: toIso(estimate.sentAt),
      approvedAt: toIso(estimate.approvedAt),
      declinedAt: toIso(estimate.declinedAt),
      notes: collapseWhitespace(estimate.notes),
      customerId: estimate.customer.id,
      customerName: estimate.customer.displayName,
      vehicleId: estimate.vehicle?.id ?? null,
      vehicleLabel: estimate.vehicle ? formatVehicleLabel(estimate.vehicle) : null,
      convertedWorkOrderNumber: estimate.convertedWorkOrder?.workOrderNumber ?? null,
    }),
    sourceUpdatedAt: estimate.updatedAt,
  }));
}

async function buildCaseDocuments(): Promise<Prisma.GaugeRetrievalIndexCreateManyInput[]> {
  const cases = await db.case.findMany({
    where: { deletedAt: null },
    orderBy: [{ updatedAt: "desc" }],
    include: {
      customer: { select: { id: true, displayName: true } },
      vehicle: {
        select: {
          id: true,
          year: true,
          make: true,
          model: true,
          unitNumber: true,
        },
      },
      assignedUser: { select: { id: true, email: true } },
      openedByUser: { select: { id: true, email: true } },
    },
  });

  return cases.map((supportCase) => ({
    sourceType: GaugeRetrievalSourceType.CASE,
    sourceId: supportCase.id,
    title: supportCase.subject,
    summary: joinText([
      supportCase.customer.displayName,
      supportCase.status,
      supportCase.priority,
      supportCase.assignedUser?.email,
    ]),
    content: buildSearchContent([
      supportCase.subject,
      supportCase.description,
      supportCase.resolutionNotes,
      supportCase.customer.displayName,
      supportCase.vehicle ? formatVehicleLabel(supportCase.vehicle) : null,
      supportCase.status,
      supportCase.priority,
      supportCase.assignedUser?.email,
      supportCase.openedByUser?.email,
    ]),
    href: `/cases/${supportCase.id}`,
    metadata: jsonValue({
      customerId: supportCase.customer.id,
      customerName: supportCase.customer.displayName,
      vehicleId: supportCase.vehicle?.id ?? null,
      vehicleLabel: supportCase.vehicle ? formatVehicleLabel(supportCase.vehicle) : null,
      status: supportCase.status,
      priority: supportCase.priority,
      assignedUserEmail: supportCase.assignedUser?.email ?? null,
      openedByUserEmail: supportCase.openedByUser?.email ?? null,
      description: clipText(supportCase.description, 220),
      resolutionNotes: clipText(supportCase.resolutionNotes, 220),
      resolvedAt: toIso(supportCase.resolvedAt),
      updatedAt: toIso(supportCase.updatedAt),
    }),
    sourceUpdatedAt: supportCase.updatedAt,
  }));
}

async function buildKbArticleDocuments(): Promise<Prisma.GaugeRetrievalIndexCreateManyInput[]> {
  const articles = await db.kbArticle.findMany({
    where: { deletedAt: null },
    orderBy: [{ updatedAt: "desc" }],
    include: {
      category: { select: { id: true, name: true } },
      author: { select: { id: true, email: true } },
    },
  });

  return articles.map((article) => ({
    sourceType: GaugeRetrievalSourceType.KB_ARTICLE,
    sourceId: article.id,
    title: article.title,
    summary: joinText([article.category?.name, article.status, article.author.email]),
    content: buildSearchContent([
      article.title,
      article.slug,
      article.body,
      article.category?.name,
      article.author.email,
      article.status,
    ]),
    href: `/kb/${article.slug}`,
    metadata: jsonValue({
      slug: article.slug,
      status: article.status,
      categoryId: article.category?.id ?? null,
      categoryName: article.category?.name ?? null,
      authorId: article.author.id,
      authorEmail: article.author.email,
      excerpt: clipText(article.body, 260),
      updatedAt: toIso(article.updatedAt),
    }),
    sourceUpdatedAt: article.updatedAt,
  }));
}

async function buildVideoDocuments(): Promise<Prisma.GaugeRetrievalIndexCreateManyInput[]> {
  const videos = await db.video.findMany({
    where: { deletedAt: null },
    orderBy: [{ updatedAt: "desc" }],
    include: {
      uploadedByUser: { select: { id: true, email: true } },
      customer: { select: { id: true, displayName: true } },
      vehicle: {
        select: {
          id: true,
          year: true,
          make: true,
          model: true,
          unitNumber: true,
        },
      },
      workOrder: {
        select: {
          id: true,
          workOrderNumber: true,
          title: true,
        },
      },
      shareLinks: {
        where: { deletedAt: null },
        orderBy: [{ createdAt: "desc" }],
        take: 1,
        select: {
          expiresAt: true,
          viewCount: true,
        },
      },
    },
  });

  return videos.map((video) => ({
    sourceType: GaugeRetrievalSourceType.VIDEO,
    sourceId: video.id,
    title: video.title,
    summary: joinText([
      video.status,
      video.workOrder?.workOrderNumber,
      video.customer?.displayName,
      video.vehicle ? formatVehicleLabel(video.vehicle) : null,
    ]),
    content: buildSearchContent([
      video.title,
      video.description,
      video.status,
      video.cloudflareId,
      video.workOrder?.workOrderNumber,
      video.workOrder?.title,
      video.customer?.displayName,
      video.vehicle ? formatVehicleLabel(video.vehicle) : null,
      video.uploadedByUser.email,
    ]),
    href: `/videos/${video.id}`,
    metadata: jsonValue({
      cloudflareId: video.cloudflareId,
      status: video.status,
      description: clipText(video.description, 240),
      durationSeconds: video.durationSeconds,
      thumbnailUrl: video.thumbnailUrl,
      uploadedByUserEmail: video.uploadedByUser.email,
      customerId: video.customer?.id ?? null,
      customerName: video.customer?.displayName ?? null,
      vehicleId: video.vehicle?.id ?? null,
      vehicleLabel: video.vehicle ? formatVehicleLabel(video.vehicle) : null,
      workOrderId: video.workOrder?.id ?? null,
      workOrderNumber: video.workOrder?.workOrderNumber ?? null,
      workOrderTitle: video.workOrder?.title ?? null,
      latestShareExpiresAt: toIso(video.shareLinks[0]?.expiresAt ?? null),
      latestShareViewCount: video.shareLinks[0]?.viewCount ?? null,
      createdAt: toIso(video.createdAt),
    }),
    sourceUpdatedAt: video.updatedAt,
  }));
}

function normalizeRetrievalSearchRow(row: RetrievalSearchRow): GaugeRetrievalHit {
  return {
    id: row.id,
    sourceType: row.sourceType as GaugeRetrievalSourceType,
    sourceId: row.sourceId,
    title: row.title,
    summary: row.summary,
    href: row.href,
    metadata: asObject(row.metadata),
    sourceUpdatedAt: toIso(row.sourceUpdatedAt),
    indexedAt: row.indexedAt.toISOString(),
    rank: Number(row.rank),
  };
}

async function searchByFallbackTokens({
  sourceType,
  query,
  visibilityFilter,
  limit,
}: {
  sourceType: GaugeRetrievalSourceType;
  query: string;
  visibilityFilter: Prisma.Sql;
  limit: number;
}) {
  const tokens = buildFallbackTokens(query);

  if (tokens.length === 0) {
    return [];
  }

  const tokenPredicates = tokens.map((token) => {
    const like = `%${token}%`;

    return Prisma.sql`
      title ILIKE ${like}
      OR coalesce(summary, '') ILIKE ${like}
      OR content ILIKE ${like}
    `;
  });

  return db.$queryRaw<RetrievalSearchRow[]>(Prisma.sql`
    SELECT
      id,
      "sourceType"::text AS "sourceType",
      "sourceId",
      title,
      summary,
      href,
      metadata,
      "sourceUpdatedAt",
      "indexedAt",
      0::double precision AS rank
    FROM "GaugeRetrievalIndex"
    WHERE "sourceType"::text = ${sourceType}
      ${visibilityFilter}
      AND (${Prisma.join(tokenPredicates, " OR ")})
    ORDER BY "sourceUpdatedAt" DESC NULLS LAST, title ASC
    LIMIT ${Math.max(1, Math.min(limit, 10))}
  `);
}

function kbVisibilityFilter(sourceType: GaugeRetrievalSourceType, role: Role) {
  if (sourceType !== GaugeRetrievalSourceType.KB_ARTICLE) {
    return Prisma.empty;
  }

  if (role === Role.ADMIN || role === Role.MANAGER || role === Role.OWNER) {
    return Prisma.empty;
  }

  return Prisma.sql`AND COALESCE(metadata->>'status', '') = ${KbArticleStatus.PUBLISHED}`;
}

function buildFallbackTokens(query: string) {
  const stopWords = new Set([
    "a",
    "about",
    "an",
    "and",
    "article",
    "case",
    "customer",
    "find",
    "for",
    "history",
    "in",
    "inventory",
    "kb",
    "knowledge",
    "look",
    "of",
    "part",
    "parts",
    "please",
    "lens",
    "search",
    "show",
    "status",
    "the",
    "up",
    "vehicle",
    "video",
    "with",
  ]);

  return Array.from(
    new Set(
      query
        .toLowerCase()
        .split(/[^a-z0-9-]+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 3)
        .filter((token) => !stopWords.has(token))
        .filter((token) => !/^[0-9a-f-]{8,}$/.test(token)),
    ),
  ).slice(0, 6);
}

function asObject(value: Prisma.JsonValue | null): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function jsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function buildSearchContent(parts: Array<string | number | null | undefined>) {
  return parts
    .flatMap((part) => (Array.isArray(part) ? part : [part]))
    .filter((part) => part !== null && part !== undefined && String(part).trim() !== "")
    .map((part) => collapseWhitespace(String(part)))
    .join(" ");
}

function joinText(parts: Array<string | number | null | undefined>) {
  return parts
    .filter((part) => part !== null && part !== undefined && String(part).trim() !== "")
    .map((part) => collapseWhitespace(String(part)))
    .join(" | ");
}

function clipText(value: string | null | undefined, maxLength: number) {
  const text = collapseWhitespace(value);

  if (!text) {
    return null;
  }

  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function collapseWhitespace(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() || null;
}

function formatVehicleLabel(vehicle: {
  year?: number | null;
  make?: string | null;
  model?: string | null;
  unitNumber?: string | null;
  licensePlate?: string | null;
}) {
  return (
    joinText([
      vehicle.unitNumber ? `Unit ${vehicle.unitNumber}` : null,
      [vehicle.year, vehicle.make, vehicle.model]
        .filter(Boolean)
        .join(" "),
      vehicle.licensePlate,
    ]) || "Vehicle"
  );
}

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}
