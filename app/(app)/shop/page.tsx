import { requirePageUser } from "@/lib/core/pageAuth";
import { db } from "@/lib/db";
import { WorkOrderBoard } from "@/components/shop/WorkOrderBoard";

export const metadata = {
  title: "Shop Floor | Home Base",
};

// Force dynamic so we get fresh data on browser back
export const dynamic = "force-dynamic";

export default async function ShopPage() {
  await requirePageUser();

  // Validate the user expects to see the shop
  // We don't block viewers from this page, but they couldn't drag and drop.
  // Wait, the API will reject standard drag drops for viewers anyway!
  // Let's pass the data to WorkOrderBoard!
  
  const workOrders = await db.workOrder.findMany({
    where: {
      deletedAt: null,
      status: { not: "CLOSED" }, // Or should we include CLOSED? Board includes it, let's omit CLOSED for less clutter unless recently closed.
      // Actually let's include recent closed maybe? Or just exclude CLOSED to keep it clean.
    },
    orderBy: { updatedAt: "desc" },
    include: {
      customer: { select: { displayName: true } },
      vehicle: { select: { make: true, model: true, year: true } },
      bay: { select: { name: true } },
    },
  });

  return (
    <div className="flex h-full flex-col space-y-6">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="bg-[radial-gradient(circle_at_top_left,_#bae6fd,_transparent_30%),linear-gradient(135deg,_#f8fafc_0%,_#e2e8f0_100%)] px-8 py-10 dark:bg-[radial-gradient(circle_at_top_left,_rgba(14,116,144,0.45),_transparent_30%),linear-gradient(135deg,_#020617_0%,_#0f172a_100%)]">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">
            Shop Operations
          </p>
          <h2 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">
            Shop Floor
          </h2>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <WorkOrderBoard initialWorkOrders={workOrders} />
      </div>
    </div>
  );
}
