import { requirePageUser } from "@/lib/core/pageAuth";
import { EstimateBuilder } from "@/components/shop/EstimateBuilder";
import { db } from "@/lib/db";

export default async function NewEstimatePage() {
  await requirePageUser();

  const customers = await db.customer.findMany({
    orderBy: { lastName: "asc" },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Create New Estimate</h1>
      </div>
      <EstimateBuilder customers={customers} />
    </div>
  );
}
