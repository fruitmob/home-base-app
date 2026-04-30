import { formatCurrency } from "@/lib/core/money";

type PipelineStage = {
  stage: "NEW" | "QUALIFIED" | "PROPOSAL" | "NEGOTIATION" | "WON" | "LOST";
  count: number;
  amount: number;
};

const stageLabels: Record<PipelineStage["stage"], string> = {
  NEW: "New",
  QUALIFIED: "Qualified",
  PROPOSAL: "Proposal",
  NEGOTIATION: "Negotiation",
  WON: "Won",
  LOST: "Lost",
};

export function PipelineSummary({
  title,
  stages,
}: {
  title: string;
  stages: PipelineStage[];
}) {
  const totalAmount = stages.reduce((sum, stage) => sum + stage.amount, 0);
  const totalCount = stages.reduce((sum, stage) => sum + stage.count, 0);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
            Pipeline
          </p>
          <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white">
            {title}
          </h3>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-sm text-slate-500 dark:text-slate-400">{totalCount} opportunities</p>
          <p className="text-2xl font-black text-slate-950 dark:text-white">
            {formatCurrency(totalAmount)}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {stages.map((stage) => (
          <div
            key={stage.stage}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"
          >
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              {stageLabels[stage.stage]}
            </p>
            <p className="mt-3 text-2xl font-black text-slate-950 dark:text-white">{stage.count}</p>
            <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
              {formatCurrency(stage.amount)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
