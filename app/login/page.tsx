import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#dbeafe,_transparent_34%),linear-gradient(135deg,_#f8fafc_0%,_#e2e8f0_50%,_#f8fafc_100%)] px-6 py-12 text-slate-950 dark:bg-[radial-gradient(circle_at_top_left,_rgba(30,64,175,0.35),_transparent_32%),linear-gradient(135deg,_#020617_0%,_#0f172a_48%,_#020617_100%)] dark:text-slate-50">
      <section className="mx-auto grid min-h-[calc(100vh-6rem)] max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">
            Home Base
          </p>
          <h1 className="mt-6 max-w-3xl text-5xl font-black tracking-tight text-slate-950 dark:text-white sm:text-6xl">
            The operating desk for serious service shops.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
            Sign in to continue building the foundation layer: secure sessions,
            role-aware access, and a clean audit trail for every future module.
          </p>
        </div>
        <div className="rounded-[2rem] border border-white/70 bg-white/85 p-8 shadow-2xl shadow-slate-900/10 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 dark:shadow-black/30">
          <div className="mb-8">
            <h2 className="text-2xl font-bold">Welcome back</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Use your owner account once the seed step has created it.
            </p>
          </div>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
