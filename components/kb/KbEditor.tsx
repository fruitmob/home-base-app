"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import "easymde/dist/easymde.min.css";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Field, inputClassName, primaryButtonClassName, secondaryButtonClassName } from "@/components/core/FormShell";

// Dynamically import simplemde to avoid SSR issues
const SimpleMdeReact = dynamic(() => import("react-simplemde-editor"), {
  ssr: false,
});

import { KbArticle, KbCategory } from "@/generated/prisma/client";

export function KbEditor({ 
  article, 
  categories 
}: { 
  article?: Partial<KbArticle>,
  categories: KbCategory[] 
}) {
  const router = useRouter();
  const [title, setTitle] = useState(article?.title || "");
  const [slug, setSlug] = useState(article?.slug || "");
  const [body, setBody] = useState(article?.body || "");
  const [categoryId, setCategoryId] = useState(article?.categoryId || "none");
  const [status, setStatus] = useState<string>(article?.status || "DRAFT");
  const [isSaving, setIsSaving] = useState(false);

  const mdeOptions = useMemo(() => {
    return {
      spellChecker: false,
      maxHeight: "500px",
      autofocus: true,
      placeholder: "Write your article using Markdown...",
      status: false,
    };
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        title,
        slug,
        body,
        categoryId: categoryId === "none" ? null : categoryId,
        status,
      };

      const url = article 
        ? `/api/kb/articles/${article.id}` 
        : `/api/kb/articles`;
      const method = article ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save article");
      }

      const savedArticle = await res.json();
      router.push(`/kb/${savedArticle.slug}`);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save article");
    } finally {
      setIsSaving(false);
    }
  };

  // Helper to autogenerate slug
  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!article) {
      setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, ""));
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Field label="Title">
          <input 
            value={title} 
            onChange={(e) => handleTitleChange(e.target.value)} 
            placeholder="e.g. How to Process Returns" 
            className={inputClassName}
          />
        </Field>
        <Field label="URL Slug">
          <input 
            value={slug} 
            onChange={(e) => setSlug(e.target.value)} 
            placeholder="how-to-process-returns" 
            className={inputClassName}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Field label="Category">
          <select 
            value={categoryId} 
            onChange={(e) => setCategoryId(e.target.value)}
            className={inputClassName}
          >
            <option value="none">None (Root)</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select 
            value={status} 
            onChange={(e) => setStatus(e.target.value)}
            className={inputClassName}
          >
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </Field>
      </div>

      <div className="prose-edit-container dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
        <SimpleMdeReact 
          value={body} 
          onChange={setBody} 
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          options={mdeOptions as any} 
        />
      </div>

      <div className="flex items-center justify-end gap-4">
        <button 
          onClick={() => router.back()}
          disabled={isSaving}
          className={secondaryButtonClassName}
        >
          Cancel
        </button>
        <button 
          onClick={handleSave} 
          disabled={isSaving || !title || !slug || !body}
          className={`${primaryButtonClassName} flex items-center justify-center`}
        >
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {article ? "Update Article" : "Publish Article"}
        </button>
      </div>
    </div>
  );
}
