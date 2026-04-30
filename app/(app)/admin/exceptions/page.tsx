import Link from "next/link";
import { requireAdminPageUser } from "@/lib/core/pageAuth";
import {
  listCustomersWithoutContacts,
  listExpiredPortalTokens,
  listExpiredVideoShareLinks,
  listOpenWorkOrdersWithoutTech,
  listStaleEstimates,
  listStaleQuotes,
} from "@/lib/admin/exceptions";

export default async function AdminExceptionsPage() {
  await requireAdminPageUser();

  const [
    customersWithoutContacts,
    staleQuotes,
    staleEstimates,
    expiredPortalTokens,
    expiredVideoShareLinks,
    openWorkOrdersWithoutTech,
  ] = await Promise.all([
    listCustomersWithoutContacts(),
    listStaleQuotes(),
    listStaleEstimates(),
    listExpiredPortalTokens(),
    listExpiredVideoShareLinks(),
    listOpenWorkOrdersWithoutTech(),
  ]);

  const total =
    customersWithoutContacts.length +
    staleQuotes.length +
    staleEstimates.length +
    expiredPortalTokens.length +
    expiredVideoShareLinks.length +
    openWorkOrdersWithoutTech.length;

  return (
    <section className="mx-auto max-w-7xl space-y-8">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="bg-[radial-gradient(circle_at_top_right,_#fca5a5,_transparent_30%),linear-gradient(135deg,_#fff1f2_0%,_#e2e8f0_100%)] px-8 py-10 dark:bg-[radial-gradient(circle_at_top_right,_rgba(239,68,68,0.3),_transparent_30%),linear-gradient(135deg,_#1c0808_0%,_#020617_100%)]">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">
            Admin Tools
          </p>
          <h2 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">
            Data Exceptions
          </h2>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
            Records that need attention before they become operational problems. These are gaps,
            expiries, and missing assignments — not errors, but things worth reviewing.
          </p>
          <div className="mt-6 flex items-center gap-4">
            <span
              className={`rounded-full px-4 py-2 text-sm font-bold ${
                total === 0
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                  : "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
              }`}
            >
              {total === 0 ? "No exceptions" : `${total} exception${total === 1 ? "" : "s"} found`}
            </span>
            <Link
              href="/admin"
              className="text-sm font-bold text-slate-600 dark:text-slate-300"
            >
              Back to admin
            </Link>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <ExceptionPanel
          title="Customers Without Contacts"
          description="Active customers with no contact records. Without a contact, there's no way to reach them."
          count={customersWithoutContacts.length}
          emptyMessage="All active customers have at least one contact."
        >
          {customersWithoutContacts.length > 0 && (
            <ExceptionTable
              headers={["Customer", "Type", "Email", "Created"]}
              rows={customersWithoutContacts.map((c) => ({
                key: c.id,
                cells: [
                  <Link
                    key="name"
                    href={`/customers/${c.id}`}
                    className="font-semibold text-slate-950 underline-offset-2 hover:underline dark:text-white"
                  >
                    {c.displayName}
                  </Link>,
                  <span key="type" className="capitalize text-slate-600 dark:text-slate-300">
                    {c.customerType.toLowerCase()}
                  </span>,
                  <span key="email" className="text-slate-600 dark:text-slate-300">
                    {c.email ?? "—"}
                  </span>,
                  <span key="created" className="text-slate-500 dark:text-slate-400">
                    {formatDate(c.createdAt)}
                  </span>,
                ],
              }))}
            />
          )}
        </ExceptionPanel>

        <ExceptionPanel
          title="Stale Quotes"
          description="Draft or sent quotes that are past their validity date or more than 30 days old with no expiry set."
          count={staleQuotes.length}
          emptyMessage="No stale quotes found."
        >
          {staleQuotes.length > 0 && (
            <ExceptionTable
              headers={["Quote #", "Customer", "Status", "Total", "Valid Until", "Created"]}
              rows={staleQuotes.map((q) => ({
                key: q.id,
                cells: [
                  <Link
                    key="num"
                    href={`/quotes/${q.id}`}
                    className="font-semibold text-slate-950 underline-offset-2 hover:underline dark:text-white"
                  >
                    {q.quoteNumber}
                  </Link>,
                  <Link
                    key="cust"
                    href={`/customers/${q.customer.id}`}
                    className="text-slate-600 underline-offset-2 hover:underline dark:text-slate-300"
                  >
                    {q.customer.displayName}
                  </Link>,
                  <StatusBadge key="status" value={q.status} />,
                  <span key="total" className="text-slate-600 dark:text-slate-300">
                    {formatCurrency(Number(q.total))}
                  </span>,
                  <span key="valid" className="text-slate-500 dark:text-slate-400">
                    {q.validUntil ? formatDate(q.validUntil) : "None set"}
                  </span>,
                  <span key="created" className="text-slate-500 dark:text-slate-400">
                    {formatDate(q.createdAt)}
                  </span>,
                ],
              }))}
            />
          )}
        </ExceptionPanel>

        <ExceptionPanel
          title="Stale Estimates"
          description="Draft or sent estimates that are past their validity date or more than 30 days old with no expiry set."
          count={staleEstimates.length}
          emptyMessage="No stale estimates found."
        >
          {staleEstimates.length > 0 && (
            <ExceptionTable
              headers={["Estimate #", "Customer", "Status", "Total", "Valid Until", "Created"]}
              rows={staleEstimates.map((e) => ({
                key: e.id,
                cells: [
                  <Link
                    key="num"
                    href={`/estimates/${e.id}`}
                    className="font-semibold text-slate-950 underline-offset-2 hover:underline dark:text-white"
                  >
                    {e.estimateNumber}
                  </Link>,
                  <Link
                    key="cust"
                    href={`/customers/${e.customer.id}`}
                    className="text-slate-600 underline-offset-2 hover:underline dark:text-slate-300"
                  >
                    {e.customer.displayName}
                  </Link>,
                  <StatusBadge key="status" value={e.status} />,
                  <span key="total" className="text-slate-600 dark:text-slate-300">
                    {formatCurrency(Number(e.total))}
                  </span>,
                  <span key="valid" className="text-slate-500 dark:text-slate-400">
                    {e.validUntil ? formatDate(e.validUntil) : "None set"}
                  </span>,
                  <span key="created" className="text-slate-500 dark:text-slate-400">
                    {formatDate(e.createdAt)}
                  </span>,
                ],
              }))}
            />
          )}
        </ExceptionPanel>

        <ExceptionPanel
          title="Expired Portal Tokens"
          description="Customer portal access tokens that have passed their expiry date but have not been explicitly revoked."
          count={expiredPortalTokens.length}
          emptyMessage="No expired portal tokens."
        >
          {expiredPortalTokens.length > 0 && (
            <ExceptionTable
              headers={["Customer", "Expired", "Last Used", "Created"]}
              rows={expiredPortalTokens.map((t) => ({
                key: t.id,
                cells: [
                  t.customer ? (
                    <Link
                      key="cust"
                      href={`/customers/${t.customer.id}`}
                      className="font-semibold text-slate-950 underline-offset-2 hover:underline dark:text-white"
                    >
                      {t.customer.displayName}
                    </Link>
                  ) : (
                    <span key="cust" className="text-slate-500 dark:text-slate-400">
                      No customer
                    </span>
                  ),
                  <span key="exp" className="text-rose-600 dark:text-rose-400">
                    {formatDate(t.expiresAt)}
                  </span>,
                  <span key="last" className="text-slate-500 dark:text-slate-400">
                    {t.lastUsedAt ? formatDate(t.lastUsedAt) : "Never"}
                  </span>,
                  <span key="created" className="text-slate-500 dark:text-slate-400">
                    {formatDate(t.createdAt)}
                  </span>,
                ],
              }))}
            />
          )}
        </ExceptionPanel>

        <ExceptionPanel
          title="Expired Video Share Links"
          description="Share links for Lens videos that have passed their expiry date but haven't been removed."
          count={expiredVideoShareLinks.length}
          emptyMessage="No expired video share links."
        >
          {expiredVideoShareLinks.length > 0 && (
            <ExceptionTable
              headers={["Video", "Expired", "Views", "Created"]}
              rows={expiredVideoShareLinks.map((l) => ({
                key: l.id,
                cells: [
                  <Link
                    key="vid"
                    href={`/videos/${l.video.id}`}
                    className="font-semibold text-slate-950 underline-offset-2 hover:underline dark:text-white"
                  >
                    {l.video.title}
                  </Link>,
                  <span key="exp" className="text-rose-600 dark:text-rose-400">
                    {l.expiresAt ? formatDate(l.expiresAt) : "—"}
                  </span>,
                  <span key="views" className="text-slate-600 dark:text-slate-300">
                    {l.viewCount}
                  </span>,
                  <span key="created" className="text-slate-500 dark:text-slate-400">
                    {formatDate(l.createdAt)}
                  </span>,
                ],
              }))}
            />
          )}
        </ExceptionPanel>

        <ExceptionPanel
          title="Open Work Orders Without Assigned Tech"
          description="Active work orders in OPEN or IN PROGRESS status with no technician assigned."
          count={openWorkOrdersWithoutTech.length}
          emptyMessage="All open work orders have an assigned technician."
        >
          {openWorkOrdersWithoutTech.length > 0 && (
            <ExceptionTable
              headers={["WO #", "Title", "Customer", "Status", "Priority", "Promised"]}
              rows={openWorkOrdersWithoutTech.map((wo) => ({
                key: wo.id,
                cells: [
                  <Link
                    key="num"
                    href={`/work-orders/${wo.id}`}
                    className="font-semibold text-slate-950 underline-offset-2 hover:underline dark:text-white"
                  >
                    {wo.workOrderNumber}
                  </Link>,
                  <span key="title" className="text-slate-700 dark:text-slate-200">
                    {wo.title}
                  </span>,
                  <Link
                    key="cust"
                    href={`/customers/${wo.customer.id}`}
                    className="text-slate-600 underline-offset-2 hover:underline dark:text-slate-300"
                  >
                    {wo.customer.displayName}
                  </Link>,
                  <StatusBadge key="status" value={wo.status} />,
                  <PriorityBadge key="priority" value={wo.priority} />,
                  <span key="promised" className="text-slate-500 dark:text-slate-400">
                    {wo.promisedAt ? formatDate(wo.promisedAt) : "—"}
                  </span>,
                ],
              }))}
            />
          )}
        </ExceptionPanel>
      </div>
    </section>
  );
}

function ExceptionPanel({
  title,
  description,
  count,
  emptyMessage,
  children,
}: {
  title: string;
  description: string;
  count: number;
  emptyMessage: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5 dark:border-slate-800">
        <div>
          <h3 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
            {title}
          </h3>
          <p className="mt-1 max-w-xl text-sm text-slate-500 dark:text-slate-400">{description}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${
            count === 0
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
          }`}
        >
          {count}
        </span>
      </div>
      {count === 0 ? (
        <p className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400">{emptyMessage}</p>
      ) : (
        children
      )}
    </div>
  );
}

function ExceptionTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: { key: string; cells: React.ReactNode[] }[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 dark:border-slate-800">
            {headers.map((h) => (
              <th
                key={h}
                className="px-6 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((row) => (
            <tr key={row.key} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
              {row.cells.map((cell, i) => (
                <td key={i} className="px-6 py-4">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ value }: { value: string }) {
  return (
    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold uppercase tracking-[0.15em] text-slate-700 dark:bg-slate-800 dark:text-slate-200">
      {value.replaceAll("_", " ")}
    </span>
  );
}

function PriorityBadge({ value }: { value: string }) {
  const colorMap: Record<string, string> = {
    URGENT: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
    HIGH: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    NORMAL: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    LOW: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-[0.15em] ${colorMap[value] ?? colorMap.NORMAL}`}
    >
      {value}
    </span>
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}
