import Link from "next/link";
import { requireAdminPageUser } from "@/lib/core/pageAuth";
import { listFeatureFlags } from "@/lib/admin/flags";
import { AdminFlagManager } from "@/components/admin/AdminFlagManager";

export default async function AdminFlagsPage() {
  const user = await requireAdminPageUser();
  const rawFlags = await listFeatureFlags();
  const flags = rawFlags.map((f) => ({
    id: f.id,
    key: f.key,
    label: f.label,
    description: f.description,
    enabled: f.enabled,
  }));

  const isOwner = user.role === "OWNER";

  return (
    <section className="mx-auto max-w-7xl space-y-8">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="bg-[radial-gradient(circle_at_top_right,_#a5b4fc,_transparent_30%),linear-gradient(135deg,_#eef2ff_0%,_#e2e8f0_100%)] px-8 py-10 dark:bg-[radial-gradient(circle_at_top_right,_rgba(99,102,241,0.35),_transparent_30%),linear-gradient(135deg,_#0f0a1e_0%,_#020617_100%)]">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">
            Admin Tools
          </p>
          <h2 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">
            Feature Flags
          </h2>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
            Control which surfaces are visible without touching code. Use flags to hide unfinished
            areas, run soft launches, or toggle shop-specific behavior.
          </p>
          <div className="mt-6 flex items-center gap-4">
            <Link
              href="/admin"
              className="text-sm font-bold text-slate-600 dark:text-slate-300"
            >
              Back to admin
            </Link>
            {!isOwner && (
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Owner role required to create or modify flags.
              </span>
            )}
          </div>
        </div>
      </div>

      <AdminFlagManager initialFlags={flags} isOwner={isOwner} />
    </section>
  );
}
