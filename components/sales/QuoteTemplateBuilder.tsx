"use client";

import { useState } from "react";
import QuoteLineEditor from "./QuoteLineEditor";
import { apiFetch } from "@/lib/api";

import { useRouter } from "next/navigation";

type QuoteTemplate = {
  id: string;
  name: string;
  description?: string | null;
  lineItems?: import("./QuoteLineEditor").LineItem[];
  [key: string]: unknown;
};

export default function QuoteTemplateBuilder({ initialTemplate }: { initialTemplate: QuoteTemplate }) {
  const router = useRouter();
  const [template, setTemplate] = useState(initialTemplate);
  const [isUpdating, setIsUpdating] = useState(false);

  const refreshTemplate = async () => {
    try {
      const res = await fetch(`/api/quote-templates/${template.id}`);
      if (res.ok) {
        const data = await res.json();
        setTemplate(data.template);
      }
    } catch (e: unknown) {
      console.error(e);
    }
  };

  const handleFieldChange = async (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>, field: "name" | "description") => {
    const val = e.target.value;
    if (val === template[field]) return; 

    setIsUpdating(true);
    try {
      await apiFetch(`/api/quote-templates/${template.id}`, {
        method: "PATCH",
        body: JSON.stringify({ [field]: val }),
      });
      refreshTemplate();
    } catch {
      alert("Failed to update template");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this template?")) return;
    try {
      await apiFetch(`/api/quote-templates/${template.id}`, { method: "DELETE" });
      router.push("/quote-templates");
    } catch {
      alert("Failed to delete template");
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 pb-6 border-b border-gray-200 dark:border-gray-800">
        <div>
           <h1 className="text-2xl font-bold flex items-center gap-3">
              Edit Template
            </h1>
        </div>
        <div>
           <button
             onClick={handleDelete}
             className="px-4 py-2 text-sm font-medium border border-red-300 text-red-700 dark:border-red-800 dark:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
           >
             Delete Template
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Template Name
              </label>
              <input
                 type="text"
                 className="w-full text-sm rounded border-gray-300 dark:border-gray-700 dark:bg-gray-800 focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50"
                 defaultValue={template.name}
                 onBlur={(e) => handleFieldChange(e, "name")}
                 disabled={isUpdating}
                 required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                 className="w-full text-sm rounded border-gray-300 dark:border-gray-700 dark:bg-gray-800 focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50"
                 rows={3}
                 defaultValue={template.description || ""}
                 onBlur={(e) => handleFieldChange(e, "description")}
                 disabled={isUpdating}
              />
            </div>
          </div>

          <h2 className="text-xl font-bold pt-4">Template Line Items</h2>
          
          <QuoteLineEditor
            parentId={template.id}
            initialLineItems={template.lineItems || []}
            isEditable={true}
            onRefresh={refreshTemplate}
            collectionEndpoint={`/api/quote-templates/${template.id}/line-items`}
            itemEndpointBase={`/api/quote-template-line-items`}
            showTotals={false}
          />
        </div>

        <div className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 rounded-lg p-4 text-sm">
             <h3 className="font-semibold mb-2">How Templates Work</h3>
             <p className="mb-2">Templates apply standard line items to a quote.</p>
             <p className="mb-2">If you leave the <strong>Quantity</strong> or <strong>Price</strong> at 0, you can configure them per-customer when building the final quote.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
