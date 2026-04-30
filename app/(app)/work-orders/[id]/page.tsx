import Link from "next/link";
import { Role } from "@/generated/prisma/client";
import { ArchiveButton } from "@/components/core/ArchiveButton";
import { WorkOrderForm } from "@/components/shop/WorkOrderForm";
import { WorkOrderHeader } from "@/components/shop/WorkOrderHeader";
import { WorkOrderLineEditor } from "@/components/shop/WorkOrderLineEditor";
import { TimerPanel } from "@/components/shop/TimerPanel";
import { canUploadVideos, canWriteWorkOrders } from "@/lib/core/permissions";
import { requirePageUser } from "@/lib/core/pageAuth";
import { findActiveWorkOrder, workOrderSubtotal } from "@/lib/shop/workOrders";
import { db } from "@/lib/db";
import { ChangeOrderPanel } from "@/components/shop/ChangeOrderPanel";
import { WoTemplatePicker } from "@/components/shop/WoTemplatePicker";
import { VideoUploader } from "@/components/video/VideoUploader";

type WorkOrderDetailPageProps = {
  params: { id: string };
};

export default async function WorkOrderDetailPage({ params }: WorkOrderDetailPageProps) {
  const user = await requirePageUser();
  const canMutate = canWriteWorkOrders(user.role);
  const userCanUploadVideos = canUploadVideos(user.role);
  const workOrder = await findActiveWorkOrder(params.id);
  const [customers, vehicles, users, bays, changeOrders] = await Promise.all([
    db.customer.findMany({
      where: { deletedAt: null },
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" },
      take: 300,
    }),
    db.vehicle.findMany({
      where: { deletedAt: null },
      select: { id: true, customerId: true, year: true, make: true, model: true, unitNumber: true },
      orderBy: [{ updatedAt: "desc" }],
      take: 300,
    }),
    db.user.findMany({
      where: {
        deletedAt: null,
        role: {
          in: [
            Role.OWNER,
            Role.ADMIN,
            Role.MANAGER,
            Role.SERVICE_MANAGER,
            Role.SERVICE_WRITER,
            Role.TECH,
          ],
        },
      },
      select: { id: true, email: true, role: true },
      orderBy: { email: "asc" },
      take: 200,
    }),
    db.bay.findMany({
      where: { deletedAt: null, active: true },
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    }),
    db.changeOrder.findMany({
      where: { workOrderId: params.id, deletedAt: null },
      select: { id: true, changeOrderNumber: true, title: true, status: true, total: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const subtotal = workOrderSubtotal(workOrder.lineItems);

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <WorkOrderHeader
        workOrderNumber={workOrder.workOrderNumber}
        title={workOrder.title}
        status={workOrder.status}
        priority={workOrder.priority}
        customer={workOrder.customer}
        vehicle={workOrder.vehicle}
        subtotal={subtotal}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h3 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
                Work Order Record
              </h3>
              <ArchiveButton
                endpoint={`/api/work-orders/${workOrder.id}`}
                label="work order"
                redirectTo="/work-orders"
                canMutate={canMutate}
              />
            </div>
            <WorkOrderForm
              initial={{
                id: workOrder.id,
                customerId: workOrder.customerId,
                vehicleId: workOrder.vehicleId,
                opportunityId: workOrder.opportunityId,
                quoteId: workOrder.quoteId,
                bayId: workOrder.bayId,
                serviceWriterUserId: workOrder.serviceWriterUserId,
                assignedTechUserId: workOrder.assignedTechUserId,
                priority: workOrder.priority,
                title: workOrder.title,
                complaint: workOrder.complaint,
                internalNotes: workOrder.internalNotes,
                odometerIn: workOrder.odometerIn,
                odometerOut: workOrder.odometerOut,
                promisedAt: workOrder.promisedAt?.toISOString() ?? null,
              }}
              customers={customers}
              vehicles={vehicles}
              users={users}
              bays={bays}
              canMutate={canMutate}
            />
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h3 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
                  Line Items
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Labor, parts, sublet, fees, and internal note lines.
                </p>
                <div className="mt-3">
                  <WoTemplatePicker workOrderId={workOrder.id} />
                </div>
              </div>
              <p className="font-black text-slate-950 dark:text-white">
                Subtotal: ${subtotal.toFixed(2)}
              </p>
            </div>
            <WorkOrderLineEditor
              workOrderId={workOrder.id}
              initialLineItems={workOrder.lineItems.map((line) => ({
                id: line.id,
                lineType: line.lineType,
                status: line.status,
                description: line.description,
                quantity: Number(line.quantity),
                unitPrice: Number(line.unitPrice),
                unitCost: line.unitCost == null ? null : Number(line.unitCost),
                lineTotal: Number(line.lineTotal),
                taxable: line.taxable,
                displayOrder: line.displayOrder,
                productId: line.productId,
                partId: line.partId,
              }))}
              canMutate={canMutate}
            />
          </article>
        </div>

        <aside className="space-y-4">
          <TimerPanel workOrderId={workOrder.id} />
          <VideoUploader
            workOrderId={workOrder.id}
            customerId={workOrder.customerId}
            vehicleId={workOrder.vehicleId}
            canUpload={userCanUploadVideos}
            initialVideos={workOrder.videos.map((video) => ({
              id: video.id,
              title: video.title,
              status: video.status,
              thumbnailUrl: video.thumbnailUrl,
              durationSeconds: video.durationSeconds,
              createdAt: video.createdAt.toISOString(),
            }))}
          />
          <ChangeOrderPanel workOrderId={workOrder.id} changeOrders={changeOrders as any /* eslint-disable-line @typescript-eslint/no-explicit-any */[]} />
          
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
              Links
            </h3>
            <div className="mt-5 space-y-3 text-sm">
              {workOrder.opportunity ? (
                <Link href={`/sales/opportunities/${workOrder.opportunity.id}`} className="block font-bold text-blue-600 hover:underline">
                  Opportunity: {workOrder.opportunity.name}
                </Link>
              ) : null}
              {workOrder.quote ? (
                <Link href={`/quotes/${workOrder.quote.id}`} className="block font-bold text-blue-600 hover:underline">
                  Quote: {workOrder.quote.quoteNumber}
                </Link>
              ) : null}
              {workOrder.arrivalInspections?.map((insp) => (
                <Link key={insp.id} href={`/inspections/${insp.id}`} className="block font-bold text-indigo-600 hover:underline">
                  Inspection: {insp.type} ({insp.status})
                </Link>
              ))}
              {workOrder.warrantyClaims?.map((claim) => (
                <Link key={claim.id} href={`/warranty/${claim.id}`} className="block font-bold text-purple-600 hover:underline">
                  Warranty Claim {claim.claimNumber ? `#${claim.claimNumber}` : `#${claim.id.slice(-8)}`} ({claim.status})
                </Link>
              ))}
              {!workOrder.opportunity && !workOrder.quote && !workOrder.arrivalInspections?.length && !workOrder.warrantyClaims?.length ? (
                <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  No linked documents yet.
                </p>
              ) : null}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
              Status History
            </h3>
            <div className="mt-5 space-y-3">
              {workOrder.statusHistory.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  No status changes yet.
                </p>
              ) : (
                workOrder.statusHistory.map((history) => (
                  <div
                    key={history.id}
                    className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"
                  >
                    <p className="text-sm font-black text-slate-950 dark:text-white">
                      {history.fromStatus ? `${history.fromStatus} -> ` : ""}
                      {history.toStatus}
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {[history.changedByUser?.email, history.reason, history.createdAt.toLocaleString()]
                        .filter(Boolean)
                        .join(" | ")}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}
