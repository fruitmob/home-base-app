import { requirePageUser } from "@/lib/core/pageAuth";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { KbEditor } from "@/components/kb/KbEditor";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { secondaryButtonClassName } from "@/components/core/FormShell";

export const metadata = {
  title: "Author Article | Knowledge Base",
};

export default async function KbAuthoringPage({
  searchParams,
}: {
  searchParams: { articleId?: string };
}) {
  const user = await requirePageUser();

  if (user.role !== "ADMIN" && user.role !== "MANAGER") {
    redirect("/kb");
  }

  let article = null;
  if (searchParams.articleId) {
    article = await db.kbArticle.findUnique({
      where: { id: searchParams.articleId },
    });
    if (!article) {
      notFound();
    }
  }

  const categories = await db.kbCategory.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Link href={article ? `/kb/${article.slug}` : "/kb"} className={`${secondaryButtonClassName} flex items-center self-start sm:self-auto`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
          <h1 className="text-3xl font-black tracking-tight">
            {article ? "Edit Article" : "New Article"}
          </h1>
        </div>
      </div>

      <div className="overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-12">
        <KbEditor article={article || undefined} categories={categories} />
      </div>
    </div>
  );
}
