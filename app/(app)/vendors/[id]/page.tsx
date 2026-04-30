import Link from "next/link";
import { notFound } from "next/navigation";
import { AddressList } from "@/components/core/AddressList";
import { ArchiveButton } from "@/components/core/ArchiveButton";
import { ContactList } from "@/components/core/ContactList";
import { VendorForm } from "@/components/core/VendorForm";
import { canWriteVendors } from "@/lib/core/permissions";
import { requirePageUser } from "@/lib/core/pageAuth";
import { db } from "@/lib/db";

type VendorDetailPageProps = {
  params: {
    id: string;
  };
};

export default async function VendorDetailPage({ params }: VendorDetailPageProps) {
  const user = await requirePageUser();
  const canMutate = canWriteVendors(user.role);
  const vendor = await db.vendor.findFirst({
    where: { id: params.id, deletedAt: null },
    include: {
      contacts: {
        where: { deletedAt: null },
        orderBy: [{ isPrimary: "desc" }, { displayName: "asc" }],
      },
      addresses: {
        where: { deletedAt: null },
        orderBy: [{ isPrimary: "desc" }, { type: "asc" }],
      },
    },
  });

  if (!vendor) {
    notFound();
  }

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link href="/vendors" className="text-sm font-bold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
            Back to vendors
          </Link>
          <h2 className="mt-3 text-4xl font-black tracking-tight text-slate-950 dark:text-white">
            {vendor.name}
          </h2>
          <p className="mt-3 text-slate-500 dark:text-slate-400">
            {[vendor.vendorType, vendor.accountNumber, vendor.email, vendor.phone]
              .filter(Boolean)
              .join(" | ") || "No vendor details"}
          </p>
        </div>
        <ArchiveButton
          endpoint={`/api/vendors/${vendor.id}`}
          label="vendor"
          redirectTo="/vendors"
          canMutate={canMutate}
        />
      </div>

      <div className="space-y-6">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-5 text-xl font-black tracking-tight text-slate-950 dark:text-white">
            Vendor Record
          </h3>
          <VendorForm initial={vendor} canMutate={canMutate} />
        </article>

        <div className="grid gap-6 xl:grid-cols-2">
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <ContactList
              ownerType="vendor"
              ownerId={vendor.id}
              contacts={vendor.contacts}
              canMutate={canMutate}
            />
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <AddressList
              ownerType="vendor"
              ownerId={vendor.id}
              addresses={vendor.addresses}
              canMutate={canMutate}
            />
          </article>
        </div>
      </div>
    </section>
  );
}
