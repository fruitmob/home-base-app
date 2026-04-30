import { requirePageUser } from "@/lib/core/pageAuth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, Edit } from "lucide-react";
import { format } from "date-fns";
import { primaryButtonClassName, secondaryButtonClassName } from "@/components/core/FormShell";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const article = await db.kbArticle.findUnique({
    where: { slug: params.slug },
  });
  if (!article) return { title: "Article Not Found" };
  return { title: `${article.title} | Knowledge Base` };
}

export default async function KbArticlePage({ params }: { params: { slug: string } }) {
  const user = await requirePageUser();

  const article = await db.kbArticle.findUnique({
    where: { slug: params.slug },
    include: {
      author: true,
      category: true,
      attachments: true,
      assignments: {
        where: { assignedToId: user.id },
        include: { completion: true },
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    },
  });

  if (!article || article.deletedAt) {
    notFound();
  }

  // Find if user has a pending assignment
  const activeAssignment = article.assignments[0];
  const isPending = activeAssignment && !activeAssignment.completion;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/kb" className={`${secondaryButtonClassName} flex items-center`}>
          <ArrowLeft className="mr-2 w-4 h-4" />
          Back
        </Link>
        {article.category && (
          <span className="text-sm font-bold uppercase tracking-wider text-slate-500">
            {article.category.name}
          </span>
        )}
        <div className="flex-1" />
        {(user.role === "ADMIN" || user.role === "MANAGER") && (
          <Link href={`/kb/authoring?articleId=${article.id}`} className={`${secondaryButtonClassName} flex items-center`}>
            <Edit className="mr-2 w-4 h-4" />
            Edit
          </Link>
        )}
      </div>

      <div className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-12">
        <header className="mb-12 text-center">
          <h1 className="mb-4 text-4xl font-black tracking-tight text-slate-900 dark:text-white sm:text-5xl">
            {article.title}
          </h1>
          <div className="flex items-center justify-center gap-2 text-sm font-medium text-slate-500">
            <span>By {article.author.email}</span>
            <span>&bull;</span>
            <span>Updated {format(new Date(article.updatedAt), "MMM d, yyyy")}</span>
          </div>
        </header>

        {isPending && (
          <div className="mb-10 overflow-hidden rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20">
            <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-bold text-amber-800 dark:text-amber-300">
                  <span className="flex h-2.5 w-2.5 rounded-full bg-amber-500"></span>
                  Training Assignment
                </h3>
                <p className="mt-1 font-medium text-amber-700 dark:text-amber-400">
                  You have been assigned to read this article. Mark as complete when finished.
                </p>
              </div>
              <form action={async () => {
                "use server";
                await db.trainingCompletion.create({
                  data: {
                    assignmentId: activeAssignment.id
                  }
                });
                const { revalidatePath } = await import("next/cache");
                revalidatePath(`/kb/${article.slug}`);
              }}>
                <button className={`${primaryButtonClassName} !bg-amber-600 hover:!bg-amber-700 dark:!bg-amber-500 !text-white`}>
                  Mark as Read
                </button>
              </form>
            </div>
          </div>
        )}

        <div className="prose prose-slate max-w-none dark:prose-invert prose-headings:font-bold prose-h1:font-black prose-a:text-indigo-600 prose-a:font-semibold hover:prose-a:text-indigo-500 dark:prose-a:text-indigo-400">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {article.body}
          </ReactMarkdown>
        </div>

        {article.attachments.length > 0 && (
          <div className="mt-16 rounded-2xl border border-slate-200 bg-slate-50 p-8 dark:border-slate-800 dark:bg-slate-950/50">
            <h3 className="mb-4 text-xl font-bold tracking-tight text-slate-900 dark:text-white">Attachments</h3>
            <ul className="space-y-3">
              {article.attachments.map(att => (
                <li key={att.id} className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900 border border-slate-100 dark:border-slate-800 transition hover:border-slate-300 dark:hover:border-slate-700">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{att.fileName}</span>
                  <a href={`/api/s3/download?key=${encodeURIComponent(att.s3Key)}`} className="text-sm font-bold tracking-wide text-indigo-600 dark:text-indigo-400 hover:underline">
                    DOWNLOAD
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
