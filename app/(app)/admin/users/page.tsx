import { Role } from "@/generated/prisma/client";
import { AdminUserManager } from "@/components/admin/AdminUserManager";
import { listAdminUsers, type AdminUserStatusFilter } from "@/lib/admin/users";
import { requireAdminPageUser } from "@/lib/core/pageAuth";

type AdminUsersPageProps = {
  searchParams?: {
    q?: string;
    role?: string;
    status?: string;
  };
};

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const currentUser = await requireAdminPageUser();
  const query = searchParams?.q?.trim() ?? "";
  const role = parseRole(searchParams?.role);
  const status = parseStatus(searchParams?.status);
  const directory = await listAdminUsers({
    query,
    role,
    status,
    take: 250,
  });
  const roles = Object.values(Role);

  return (
    <section className="mx-auto max-w-7xl space-y-8">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="bg-[radial-gradient(circle_at_top_left,_#bfdbfe,_transparent_35%),linear-gradient(135deg,_#eff6ff_0%,_#e2e8f0_100%)] px-8 py-10 dark:bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.3),_transparent_35%),linear-gradient(135deg,_#0f172a_0%,_#020617_100%)]">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">
            Admin Tools
          </p>
          <h2 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">
            User Directory
          </h2>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
            Create accounts, shift roles, and safely disable or restore access without losing history.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Active" value={directory.counts.active} />
        <MetricCard label="Disabled" value={directory.counts.inactive} />
        <MetricCard label="Total" value={directory.counts.total} />
      </div>

      <form className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-[1fr_220px_180px_auto]">
        <label>
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Search
          </span>
          <input
            name="q"
            defaultValue={query}
            placeholder="Email address"
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-slate-800"
          />
        </label>
        <label>
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Role
          </span>
          <select
            name="role"
            defaultValue={role ?? ""}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-slate-800"
          >
            <option value="">All roles</option>
            {roles.map((entry) => (
              <option key={entry} value={entry}>
                {entry.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Status
          </span>
          <select
            name="status"
            defaultValue={status}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-slate-800"
          >
            <option value="all">All accounts</option>
            <option value="active">Active only</option>
            <option value="inactive">Disabled only</option>
          </select>
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            className="w-full rounded-full border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Apply filters
          </button>
        </div>
      </form>

      <AdminUserManager
        currentUserId={currentUser.id}
        roles={roles}
        users={directory.users.map((user) => ({
          id: user.id,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          disabledAt: user.disabledAt?.toISOString() ?? null,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        }))}
      />
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-3 text-4xl font-black tracking-tight text-slate-950 dark:text-white">
        {value}
      </p>
    </div>
  );
}

function parseRole(value: string | undefined) {
  if (!value) {
    return null;
  }

  return Object.values(Role).includes(value as Role) ? (value as Role) : null;
}

function parseStatus(value: string | undefined): AdminUserStatusFilter {
  return value === "active" || value === "inactive" || value === "all" ? value : "all";
}
