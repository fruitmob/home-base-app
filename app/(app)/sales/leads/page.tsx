import Link from "next/link";
import { Prisma, Role, LeadStatus } from "@/generated/prisma/client";
import { LeadForm } from "@/components/sales/LeadForm";
import { LeadStatusBadge } from "@/components/sales/LeadStatusBadge";
import { formatCurrency } from "@/lib/core/money";
import { requirePageUser } from "@/lib/core/pageAuth";
import { db } from "@/lib/db";
import { SALES_WRITE_ROLES } from "@/lib/core/permissions";

type LeadsPageProps = {
  searchParams?: {
    q?: string;
    status?: string;
    ownerUserId?: string;
  };
};

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  const user = await requirePageUser();
  const canMutate = (SALES_WRITE_ROLES as readonly string[]).includes(user.role);
  
  const query = searchParams?.q?.trim() ?? "";
  const statusParam = searchParams?.status?.trim() ?? "";
  const ownerUserIdParam = searchParams?.ownerUserId?.trim() ?? "";

  const whereAnd: Prisma.LeadWhereInput[] = [{ deletedAt: null }];

  if (query) {
    whereAnd.push({
      OR: [
        { displayName: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { companyName: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { email: { contains: query, mode: Prisma.QueryMode.insensitive } },
      ],
    });
  }

  if (statusParam) {
    whereAnd.push({ status: statusParam as LeadStatus });
  }

  if (user.role === Role.SALES_REP) {
    if (ownerUserIdParam === user.id) {
      whereAnd.push({ ownerUserId: user.id });
    } else if (ownerUserIdParam === "unassigned") {
      whereAnd.push({ ownerUserId: null });
    } else if (ownerUserIdParam) {
      // Sales reps cannot view others' leads explicitly
      whereAnd.push({ id: "restricted" }); 
    } else {
      whereAnd.push({
        OR: [{ ownerUserId: user.id }, { ownerUserId: null }],
      });
    }
  } else {
    if (ownerUserIdParam === "unassigned") {
      whereAnd.push({ ownerUserId: null });
    } else if (ownerUserIdParam) {
      whereAnd.push({ ownerUserId: ownerUserIdParam });
    }
  }

  const [leads, activeLeadCount] = await Promise.all([
    db.lead.findMany({
      where: { AND: whereAnd },
      orderBy: [{ createdAt: "desc" }],
      take: 200,
      include: {
        ownerUser: { select: { email: true } },
      },
    }),
    db.lead.count({
      where: { deletedAt: null, status: { notIn: ["CONVERTED", "UNQUALIFIED"] } },
    }),
  ]);

  return (
    <section className="mx-auto max-w-7xl space-y-8">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="bg-[radial-gradient(circle_at_top_right,_#bfdbfe,_transparent_35%),linear-gradient(135deg,_#f8fafc_0%,_#e2e8f0_100%)] px-8 py-10 dark:bg-[radial-gradient(circle_at_top_right,_rgba(30,64,175,0.5),_transparent_35%),linear-gradient(135deg,_#020617_0%,_#0f172a_100%)]">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">
            Sales CRM
          </p>
          <h2 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">
            Lead Pipeline
          </h2>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
            Manage inquiries, assign potential buyers, and convert interested prospects into actionable Opportunities.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <span className="rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white dark:bg-white dark:text-slate-950">
              {activeLeadCount} active lead{activeLeadCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <form className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-end">
            <label className="flex-1">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Search leads
              </span>
              <input
                name="q"
                defaultValue={query}
                placeholder="Name, company, email"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-slate-800"
              />
            </label>
            <label className="md:w-48">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Status
              </span>
              <select
                name="status"
                defaultValue={statusParam}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-slate-800"
              >
                <option value="">Any</option>
                <option value="NEW">New</option>
                <option value="WORKING">Working</option>
                <option value="QUALIFIED">Qualified</option>
                <option value="CONVERTED">Converted</option>
                <option value="UNQUALIFIED">Unqualified</option>
              </select>
            </label>
            <label className="md:w-48">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Assigned
              </span>
              <select
                name="ownerUserId"
                defaultValue={ownerUserIdParam}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-slate-800"
              >
                <option value="">Anyone</option>
                <option value={user.id}>Me</option>
                <option value="unassigned">Unassigned</option>
              </select>
            </label>
            <button
              type="submit"
              className="rounded-full border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Apply
            </button>
          </form>

          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            {leads.length === 0 ? (
              <p className="p-8 text-slate-500 dark:text-slate-400">No leads found.</p>
            ) : (
              <table className="w-full divide-y divide-slate-100 text-sm dark:divide-slate-800">
                <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3">Lead</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Source</th>
                    <th className="px-5 py-3">Est. Value</th>
                    <th className="px-5 py-3">Assigned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {leads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                      <td className="px-5 py-4">
                        <Link href={`/sales/leads/${lead.id}`} className="block">
                          <span className="font-bold text-slate-950 dark:text-white block">
                            {lead.displayName}
                          </span>
                          {lead.companyName && (
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {lead.companyName}
                            </span>
                          )}
                        </Link>
                      </td>
                      <td className="px-5 py-4">
                        <Link href={`/sales/leads/${lead.id}`}>
                          <LeadStatusBadge status={lead.status} />
                        </Link>
                      </td>
                      <td className="px-5 py-4 text-slate-500 dark:text-slate-400">
                        {lead.source}
                      </td>
                      <td className="px-5 py-4 text-slate-700 dark:text-slate-200">
                        {formatCurrency(lead.estimatedValue)}
                      </td>
                      <td className="px-5 py-4 text-slate-500 dark:text-slate-400">
                        {lead.ownerUser?.email ?? "Unassigned"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
            New Lead
          </h3>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Track a new inquiry. New leads can be converted into standard customer opportunities.
          </p>
          <div className="mt-6">
            <LeadForm canMutate={canMutate} />
          </div>
        </aside>
      </div>
    </section>
  );
}
