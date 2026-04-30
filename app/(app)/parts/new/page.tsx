import { requirePageUser } from "@/lib/core/pageAuth";
import { PartForm } from "@/components/shop/PartForm";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/20/solid";

export default async function NewPartPage() {
  await requirePageUser();

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <Link
          href="/parts"
          className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          <ArrowLeftIcon className="mr-1 h-4 w-4" />
          Back to parts
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">New Part</h1>
      </div>

      <PartForm />
    </div>
  );
}
