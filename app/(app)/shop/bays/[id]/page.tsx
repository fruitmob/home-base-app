import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/core/pageAuth";
import { assertWorkOrderWriteRole } from "@/lib/core/api";
import { BayForm } from "@/components/shop/BayForm";
import { db } from "@/lib/db";

export const metadata = {
  title: "Edit Bay | Home Base",
};

export default async function EditBayPage({ params }: { params: { id: string } }) {
  const user = await requirePageUser();
  assertWorkOrderWriteRole(user);

  const bay = await db.bay.findUnique({
    where: { id: params.id, deletedAt: null },
  });

  if (!bay) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Link href="/shop/bays" className="text-sm font-bold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
          Back to Bays
        </Link>
        <h2 className="mt-3 text-4xl font-black tracking-tight text-slate-950 dark:text-white">
          Edit Bay
        </h2>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <BayForm initial={bay} />
      </div>
    </div>
  );
}
