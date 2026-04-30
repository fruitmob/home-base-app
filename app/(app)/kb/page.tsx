import { requirePageUser } from "@/lib/core/pageAuth";
import { db } from "@/lib/db";
import Link from "next/link";
import { BookOpen, Folder, Plus } from "lucide-react";
import { secondaryButtonClassName } from "@/components/core/FormShell";

export const metadata = {
  title: "Knowledge Base | Home Base",
};

export default async function KnowledgeBasePage() {
  const user = await requirePageUser();

  // Fetch top-level categories and top-level articles 
  const categories = await db.kbCategory.findMany({
    where: { parentId: null, deletedAt: null },
    orderBy: { name: "asc" },
  });

  const topArticles = await db.kbArticle.findMany({
    where: { categoryId: null, deletedAt: null, status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Knowledge Base</h1>
          <p className="text-slate-500 dark:text-slate-400">
            Standard operating procedures and documents.
          </p>
        </div>
        {(user.role === "ADMIN" || user.role === "MANAGER") && (
          <div className="flex items-center gap-2">
            <Link href="/kb/authoring" className={`${secondaryButtonClassName} flex items-center`}>
              <Plus className="mr-2 h-4 w-4" />
              Author Article
            </Link>
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-[2xl] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-2 text-lg font-bold tracking-tight">
            <Folder className="h-5 w-5 text-indigo-500" />
            Categories
          </div>
          <div>
            {categories.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No categories found.</p>
            ) : (
              <ul className="space-y-3">
                {categories.map((cat) => (
                  <li key={cat.id}>
                    <Link
                      href={`/kb/category/${cat.id}`}
                      className="block font-semibold text-slate-700 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400 transition"
                    >
                      {cat.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="rounded-[2xl] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-2 text-lg font-bold tracking-tight">
            <BookOpen className="h-5 w-5 text-blue-500" />
            Recent Articles
          </div>
          <div>
            {topArticles.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No uncategorized articles found.</p>
            ) : (
              <ul className="space-y-4">
                {topArticles.map((article) => (
                  <li key={article.id}>
                    <Link
                      href={`/kb/${article.slug}`}
                      className="block group"
                    >
                      <span className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                        {article.title}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
