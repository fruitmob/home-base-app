import { GaugeChat } from "@/components/gauge/GaugeChat";
import { requirePageUser } from "@/lib/core/pageAuth";

export default async function GaugePage() {
  await requirePageUser();

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase text-blue-600 dark:text-blue-300">Gauge AI</p>
        <h2 className="mt-2 text-3xl font-black text-slate-950 dark:text-white">
          Shop assistant
        </h2>
        <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">
          Ask about live shop data, draft operational notes, and build toward safe tool-assisted workflows.
        </p>
      </div>

      <GaugeChat />
    </section>
  );
}
