import { WorkOrderStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/core/money";
import { withPublicApi } from "@/lib/api-keys/public";

export async function GET(request: Request) {
  return withPublicApi(request, "work-orders.read", async ({ params, url }) => {
    const statusParam = url.searchParams.get("status")?.trim();
    const customerId = url.searchParams.get("customerId")?.trim() || undefined;

    const statusFilter = parseStatusList(statusParam);

    const where = {
      deletedAt: null,
      ...(customerId ? { customerId } : {}),
      ...(statusFilter ? { status: { in: statusFilter } } : {}),
    };

    const [rows, total] = await Promise.all([
      db.workOrder.findMany({
        where,
        orderBy: [{ openedAt: "desc" }],
        take: params.limit,
        skip: params.offset,
        select: {
          id: true,
          workOrderNumber: true,
          title: true,
          status: true,
          priority: true,
          customerId: true,
          vehicleId: true,
          openedAt: true,
          promisedAt: true,
          closedAt: true,
          createdAt: true,
          updatedAt: true,
          lineItems: {
            where: { deletedAt: null },
            select: { lineTotal: true, taxable: true },
          },
        },
      }),
      db.workOrder.count({ where }),
    ]);

    return {
      data: rows.map((row) => {
        const subtotal = row.lineItems.reduce((sum, line) => sum + toNumber(line.lineTotal), 0);
        return {
          id: row.id,
          workOrderNumber: row.workOrderNumber,
          title: row.title,
          status: row.status,
          priority: row.priority,
          customerId: row.customerId,
          vehicleId: row.vehicleId,
          openedAt: row.openedAt.toISOString(),
          promisedAt: row.promisedAt?.toISOString() ?? null,
          closedAt: row.closedAt?.toISOString() ?? null,
          subtotal,
          lineItemCount: row.lineItems.length,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        };
      }),
      meta: { total, limit: params.limit, offset: params.offset },
    };
  });
}

function parseStatusList(raw: string | null | undefined): WorkOrderStatus[] | null {
  if (!raw) return null;
  const valid = new Set<string>(Object.values(WorkOrderStatus));
  const parsed = raw
    .split(",")
    .map((entry) => entry.trim().toUpperCase())
    .filter((entry) => valid.has(entry)) as WorkOrderStatus[];
  return parsed.length === 0 ? null : parsed;
}
