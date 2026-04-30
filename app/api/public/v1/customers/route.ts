import { db } from "@/lib/db";
import { withPublicApi } from "@/lib/api-keys/public";

export async function GET(request: Request) {
  return withPublicApi(request, "customers.read", async ({ params }) => {
    const [rows, total] = await Promise.all([
      db.customer.findMany({
        where: { deletedAt: null },
        orderBy: [{ createdAt: "desc" }],
        take: params.limit,
        skip: params.offset,
        select: {
          id: true,
          displayName: true,
          firstName: true,
          lastName: true,
          customerType: true,
          email: true,
          phone: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      db.customer.count({ where: { deletedAt: null } }),
    ]);

    return {
      data: rows.map((row) => ({
        id: row.id,
        displayName: row.displayName,
        firstName: row.firstName,
        lastName: row.lastName,
        customerType: row.customerType,
        email: row.email,
        phone: row.phone,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
      meta: { total, limit: params.limit, offset: params.offset },
    };
  });
}
