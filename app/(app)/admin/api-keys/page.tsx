import Link from "next/link";
import { listApiKeysForAdmin } from "@/lib/api-keys/admin";
import { API_KEY_SCOPE_CATALOG } from "@/lib/api-keys/scopes";
import { requireAdminPageUser } from "@/lib/core/pageAuth";
import { ApiKeysAdminBoard } from "@/components/admin/ApiKeysAdminBoard";

export default async function AdminApiKeysPage() {
  await requireAdminPageUser();
  const keys = await listApiKeysForAdmin();

  return (
    <section className="mx-auto max-w-7xl space-y-8">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="bg-[radial-gradient(circle_at_top_right,_#818cf8,_transparent_26%),linear-gradient(135deg,_#eef2ff_0%,_#e2e8f0_100%)] px-8 py-10 dark:bg-[radial-gradient(circle_at_top_right,_rgba(129,140,248,0.28),_transparent_26%),linear-gradient(135deg,_#1f2937_0%,_#020617_100%)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">
                Integrations
              </p>
              <h2 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">
                API keys for the public read API.
              </h2>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300">
                Each key scopes access to the public read endpoints under{" "}
                <span className="font-mono text-base">/api/public/v1</span>. Home Base stores only
                the hash of the key — the full value is shown exactly once when you issue it, so
                keep it somewhere safe right away.
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

      <ApiKeysAdminBoard
        initialKeys={keys}
        scopeCatalog={API_KEY_SCOPE_CATALOG.map((entry) => ({
          scope: entry.scope,
          label: entry.label,
          description: entry.description,
        }))}
      />
    </section>
  );
}
