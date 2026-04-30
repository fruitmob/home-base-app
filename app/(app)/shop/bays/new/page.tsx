import Link from "next/link";
import { requirePageUser } from "@/lib/core/pageAuth";
import { assertWorkOrderWriteRole } from "@/lib/core/api";
import { BayForm } from "@/components/shop/BayForm";

export const metadata = {
  title: "New Bay | Home Base",
};

export default async function NewBayPage() {
  const user = await requirePageUser();
  assertWorkOrderWriteRole(user);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Link href="/shop/bays" className="text-sm font-bold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
          Back to Bays
        </Link>
        <h2 className="mt-3 text-4xl font-black tracking-tight text-slate-950 dark:text-white">
          New Bay
        </h2>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <BayForm />
      </div>
    </div>
  );
}
