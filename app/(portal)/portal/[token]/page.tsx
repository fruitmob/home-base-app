import { notFound } from "next/navigation";
import { verifyPortalToken } from "@/lib/shop/portal";
import { db } from "@/lib/db";
import { format } from "date-fns";
import PortalEstimatesPanel from "./_components/PortalEstimatesPanel";
import PortalChatPanel from "./_components/PortalChatPanel";
import PortalUploadPanel from "./_components/PortalUploadPanel";

export default async function PortalPage({ params }: { params: { token: string } }) {
  const check = await verifyPortalToken(params.token);

  if (!check.valid) {
    return (
      <div className="flex flex-col items-center justify-center pt-20 text-center space-y-4">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold">Link Expired or Invalid</h2>
        <p className="text-gray-500 max-w-md">
          {check.reason === "EXPIRED" 
            ? "For your security, this portal link has expired. Please contact the shop for a new link."
            : "This link is no longer valid. Please contact the shop for a new link."}
        </p>
      </div>
    );
  }

  // We have a valid token! Load customer and whatever active things they have.
  const tokenRecord = check.token!;

  const customer = await db.customer.findUnique({
    where: { id: tokenRecord.customerId || "" },
    include: {
      workOrders: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 3,
        include: {
          vehicle: true,
        }
      },
      vehicles: {
        where: { deletedAt: null },
      },
      estimates: {
        where: { status: "SENT", deletedAt: null },
        orderBy: { createdAt: "desc" },
        include: {
          lineItems: true,
          vehicle: true,
        }
      },
      portalMessages: {
        orderBy: { createdAt: "asc" },
        include: {
          author: true,
        }
      },
      portalUploads: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!customer) {
    return notFound();
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 md:p-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          Welcome, {customer.firstName || customer.displayName}
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          This is your private dashboard to track repairs, approve estimates, and chat directly with your technician.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center">
            <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Active Orders
          </h2>
          
          {customer.workOrders.length === 0 ? (
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-8 text-center border border-gray-100 dark:border-gray-800 border-dashed">
              <p className="text-gray-500">You don&apos;t have any current work orders.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {customer.workOrders.map(wo => (
                <div key={wo.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                  <div className="p-5">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                            {wo.status.replace(/_/g, " ")}
                          </span>
                          <span className="text-sm font-medium text-gray-500">WO-{wo.id.slice(-6).toUpperCase()}</span>
                        </div>
                        <h3 className="text-lg font-bold">
                          {wo.vehicle ? `${wo.vehicle.year} ${wo.vehicle.make} ${wo.vehicle.model}` : 'General Service'}
                        </h3>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-500">Created</div>
                        <div className="font-medium text-sm">{format(new Date(wo.createdAt), "MMM d, yyyy")}</div>
                      </div>
                    </div>
                    
                    {/* Placeholder for timeline and actions */}
                    <div className="pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-end">
                      <button className="text-sm px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Portal Estimates Approvals */}
        {customer.estimates && customer.estimates.length > 0 && (
          <PortalEstimatesPanel
            estimates={customer.estimates as never}
            token={tokenRecord.token}
          />
        )}

        {/* Portal File Uploads */}
        <PortalUploadPanel token={tokenRecord.token} existingUploads={customer.portalUploads} />

        {/* Portal Chat */}
        <PortalChatPanel initialMessages={customer.portalMessages as never} token={tokenRecord.token} />
      </div>
    </div>
  );
}
