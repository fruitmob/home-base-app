import Link from "next/link";
import { requireAdminPageUser } from "@/lib/core/pageAuth";
import { WEBHOOK_EVENT_CATALOG } from "@/lib/webhooks/events";
import {
  listRecentWebhookDeliveries,
  listWebhookEndpointsForAdmin,
} from "@/lib/webhooks/admin";
import { WebhooksAdminBoard } from "@/components/admin/WebhooksAdminBoard";

export default async function AdminWebhooksPage() {
  await requireAdminPageUser();
  const [endpoints, deliveries] = await Promise.all([
    listWebhookEndpointsForAdmin(),
    listRecentWebhookDeliveries(50),
  ]);

  return (
    <section className="mx-auto max-w-7xl space-y-8">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="bg-[radial-gradient(circle_at_top_right,_#34d399,_transparent_26%),linear-gradient(135deg,_#ecfdf5_0%,_#e2e8f0_100%)] px-8 py-10 dark:bg-[radial-gradient(circle_at_top_right,_rgba(52,211,153,0.28),_transparent_26%),linear-gradient(135deg,_#1f2937_0%,_#020617_100%)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">
                Integrations
              </p>
              <h2 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">
                Outbound webhooks and delivery history.
              </h2>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300">
                Configure HTTPS endpoints that receive signed Home Base events, rotate secrets when
                they leak, toggle endpoints on or off, and run the delivery queue manually to verify
                retry behavior.
              </p>
            </div>
            <Link
              href="/admin"
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Back to admin
            </Link>
          </div>
        </div>
      </div>

      <WebhooksAdminBoard
        initialEndpoints={endpoints}
        initialDeliveries={deliveries}
        eventCatalog={WEBHOOK_EVENT_CATALOG.map((entry) => ({
          type: entry.type,
          label: entry.label,
          description: entry.description,
        }))}
      />
    </section>
  );
}
