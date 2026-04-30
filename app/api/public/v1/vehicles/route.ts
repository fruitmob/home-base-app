import { db } from "@/lib/db";
import { withPublicApi } from "@/lib/api-keys/public";

export async function GET(request: Request) {
  return withPublicApi(request, "vehicles.read", async ({ params, url }) => {
    const customerId = url.searchParams.get("customerId")?.trim() || undefined;

    const where = {
      deletedAt: null,
      ...(customerId ? { customerId } : {}),
    };

    const [rows, total] = await Promise.all([
      db.vehicle.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        take: params.limit,
        skip: params.offset,
        select: {
          id: true,
          customerId: true,
          year: true,
          make: true,
          model: true,
          trim: true,
          vin: true,
          licensePlate: true,
          licenseState: true,
          unitNumber: true,
          currentMileage: true,
          color: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      db.vehicle.count({ where }),
    ]);

    return {
      data: rows.map((row) => ({
        id: row.id,
        customerId: row.customerId,
        year: row.year,
        make: row.make,
        model: row.model,
        trim: row.trim,
        vin: row.vin,
        licensePlate: row.licensePlate,
        licenseState: row.licenseState,
        unitNumber: row.unitNumber,
        currentMileage: row.currentMileage,
        color: row.color,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
      meta: { total, limit: params.limit, offset: params.offset },
    };
  });
}
