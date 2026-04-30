"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";

type Template = {
  id: string;
  name: string;
  description: string | null;
};

type QuoteTemplatePickerProps = {
  quoteId: string;
  onApplied: () => void;
};

export default function QuoteTemplatePicker({ quoteId, onApplied }: QuoteTemplatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen]);

  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/quote-templates");
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (e) {
      console.error(e);
    }
  };

  const applyTemplate = async (templateId: string) => {
    setIsApplying(true);
    try {
      const res = await apiFetch(`/api/quotes/${quoteId}/apply-template`, {
        method: "POST",
        body: JSON.stringify({ templateId }),
      });
      if (res.ok) {
        setIsOpen(false);
        onApplied();
      } else {
        const d = await res.json();
        alert(d.error || "Failed to apply template");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
      >
        Apply Template
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-lg w-full overflow-hidden border border-gray-200 dark:border-gray-800">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
              <h2 className="text-lg font-bold">Apply Quote Template</h2>
              <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                ✕
              </button>
            </div>
            
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {templates.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No active templates found.</p>
              ) : (
                <div className="space-y-3">
                  {templates.map(t => (
                    <div key={t.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-md flex justify-between items-center hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-white">{t.name}</div>
                        {t.description && <div className="text-sm text-gray-500">{t.description}</div>}
                      </div>
                      <button
                        onClick={() => applyTemplate(t.id)}
                        disabled={isApplying}
                        className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        Apply
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button 
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                disabled={isApplying}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
