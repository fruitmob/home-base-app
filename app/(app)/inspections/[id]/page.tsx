import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/core/pageAuth";
import { db } from "@/lib/db";
import Link from "next/link";
import { InspectionChecklist } from "@/components/shop/InspectionChecklist";
import { InspectionActions } from "@/components/shop/InspectionActions";

export default async function InspectionDetailPage({ params }: { params: { id: string } }) {
  await requirePageUser();

  const inspection = await db.arrivalInspection.findUnique({
    where: { id: params.id },
    include: {
      customer: true,
      vehicle: true,
      workOrder: true,
      items: { orderBy: { displayOrder: "asc" } },
    },
  });

  if (!inspection || inspection.deletedAt) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <Link href="/inspections" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
          &larr; Back to Inspections
        </Link>
      </div>

      <div className="md:flex md:items-center md:justify-between mb-8">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 dark:text-white sm:truncate sm:text-3xl sm:tracking-tight">
            {inspection.type} Inspection #{inspection.id.slice(-8)}
          </h2>
          <div className="mt-1 flex flex-col sm:mt-0 sm:flex-row sm:flex-wrap sm:space-x-6">
            <div className="mt-2 flex items-center text-sm text-gray-500">
              Customer: {inspection.customer.firstName} {inspection.customer.lastName}
            </div>
            <div className="mt-2 flex items-center text-sm text-gray-500">
              Vehicle: {inspection.vehicle.year} {inspection.vehicle.make} {inspection.vehicle.model}
            </div>
            {inspection.workOrder && (
              <div className="mt-2 flex items-center text-sm text-gray-500">
                Work Order: <Link href={`/work-orders/${inspection.workOrder.id}`} className="ml-1 text-indigo-600 hover:underline">{inspection.workOrder.workOrderNumber}</Link>
              </div>
            )}
          </div>
        </div>
        <div className="mt-4 flex md:ml-4 md:mt-0">
          <InspectionActions inspectionId={inspection.id} currentStatus={inspection.status} />
        </div>
      </div>

      <div className="bg-slate-50 dark:bg-zinc-800 rounded-lg p-6 mb-8 border border-slate-200 dark:border-zinc-700">
        <h3 className="text-lg font-bold mb-4">Inspection Checklist</h3>
        <InspectionChecklist 
          inspectionId={inspection.id} 
          items={inspection.items as any /* eslint-disable-line @typescript-eslint/no-explicit-any */} 
          status={inspection.status} 
        />
      </div>

    </div>
  );
}
