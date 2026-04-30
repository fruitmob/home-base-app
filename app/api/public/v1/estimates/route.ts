import { EstimateStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/core/money";
import { withPublicApi } from "@/lib/api-keys/public";

export async function GET(request: Request) {
  return withPublicApi(request, "estimates.read", async ({ params, url }) => {
    const customerId = url.searchParams.get("customerId")?.trim() || undefined;
    const statusFilter = parseStatusList(url.searchParams.get("status"));

    const where = {
      deletedAt: null,
      ...(customerId ? { customerId } : {}),
      ...(statusFilter ? { status: { in: statusFilter } } : {}),
    };

    const [rows, total] = await Promise.all([
      db.estimate.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        take: params.limit,
        skip: params.offset,
        select: {
          id: true,
          estimateNumber: true,
          title: true,
          status: true,
          customerId: true,
          vehicleId: true,
          subtotal: true,
          taxTotal: true,
          total: true,
          sentAt: true,
          approvedAt: true,
          declinedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      db.estimate.count({ where }),
    ]);

    return {
      data: rows.map((row) => ({
        id: row.id,
        estimateNumber: row.estimateNumber,
        title: row.title,
        status: row.status,
        customerId: row.customerId,
        vehicleId: row.vehicleId,
        subtotal: toNumber(row.subtotal),
        taxTotal: toNumber(row.taxTotal),
        total: toNumber(row.total),
        sentAt: row.sentAt?.toISOString() ?? null,
        approvedAt: row.approvedAt?.toISOString() ?? null,
        declinedAt: row.declinedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
      meta: { total, limit: params.limit, offset: params.offset },
    };
  });
}

function parseStatusList(raw: string | null): EstimateStatus[] | null {
  if (!raw) return null;
  const valid = new Set<string>(Object.values(EstimateStatus));
  const parsed = raw
    .split(",")
    .map((entry) => entry.trim().toUpperCase())
    .filter((entry) => valid.has(entry)) as EstimateStatus[];
  return parsed.length === 0 ? null : parsed;
}
