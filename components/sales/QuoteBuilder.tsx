"use client";

import { useState } from "react";
import QuoteHeader from "./QuoteHeader";
import QuoteTemplatePicker from "./QuoteTemplatePicker";
import QuoteLineEditor from "./QuoteLineEditor";
import { apiFetch } from "@/lib/api";

type Quote = {
  id: string;
  quoteNumber: string;
  status: "DRAFT" | "SENT" | "ACCEPTED" | "DECLINED" | "EXPIRED";
  issuedAt?: string | Date | null;
  validUntil?: string | Date | null;
  subtotal: number | string | { toString(): string };
  taxTotal: number | string | { toString(): string };
  total: number | string | { toString(): string };
  notes?: string | null;
  customer?: { displayName: string } | null;
  lineItems?: import("./QuoteLineEditor").LineItem[];
  revisions?: { id: string; quoteNumber: string }[];
  parentQuote?: { id: string; quoteNumber: string } | null;
  [key: string]: unknown;
}; 
export default function QuoteBuilder({ initialQuote }: { initialQuote: Quote }) {
  const [quote, setQuote] = useState(initialQuote);
  const [isUpdatingNotes, setIsUpdatingNotes] = useState(false);

  const isEditable = quote.status === "DRAFT";

  const refreshQuote = async () => {
    try {
      const res = await fetch(`/api/quotes/${quote.id}`);
      if (res.ok) {
        const data = await res.json();
        setQuote(data.quote);
      }
    } catch (e: unknown) {
      console.error(e);
    }
  };

  const handleNotesChange = async (e: React.FocusEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val === quote.notes) return;

    setIsUpdatingNotes(true);
    try {
      await apiFetch(`/api/quotes/${quote.id}`, {
        method: "PATCH",
        body: JSON.stringify({ notes: val }),
      });
      refreshQuote();
    } catch (e: unknown) {
      console.error(e);
      alert("Failed to update notes");
    } finally {
      setIsUpdatingNotes(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <QuoteHeader
        quoteId={quote.id}
        quoteNumber={quote.quoteNumber}
        status={quote.status}
        issuedAt={quote.issuedAt}
        validUntil={quote.validUntil}
        customerName={quote.customer?.displayName || "Unknown Customer"}
        onRefresh={refreshQuote}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-end">
            <h2 className="text-xl font-bold">Line Items</h2>
            {isEditable && (
              <QuoteTemplatePicker quoteId={quote.id} onApplied={refreshQuote} />
            )}
          </div>
          
          <QuoteLineEditor
            parentId={quote.id}
            initialLineItems={quote.lineItems || []}
            isEditable={isEditable}
            onRefresh={refreshQuote}
            collectionEndpoint={`/api/quotes/${quote.id}/line-items`}
            itemEndpointBase={`/api/quote-line-items`}
          />

          <div className="flex justify-end pt-4">
            <div className="w-64 space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>${Number(quote.subtotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 dark:border-gray-700 pb-2">
                <span>Tax:</span>
                <span>${Number(quote.taxTotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg text-gray-900 dark:text-white pt-2">
                <span>Total:</span>
                <span>${Number(quote.total).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-4">
            <h3 className="font-semibold mb-3">Customer Notes</h3>
            <textarea
              className="w-full text-sm rounded border-gray-300 dark:border-gray-700 dark:bg-gray-800 focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50"
              rows={4}
              defaultValue={quote.notes || ""}
              onBlur={handleNotesChange}
              disabled={!isEditable || isUpdatingNotes}
              placeholder="Visible on the PDF..."
            />
          </div>

          {quote.parentQuote && (
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 text-sm">
               <span className="font-semibold block mb-1">Revises:</span>
               <a href={`/quotes/${quote.parentQuote.id}`} className="text-blue-600 hover:underline">
                  {quote.parentQuote.quoteNumber}
               </a>
            </div>
          )}
          
          {(quote.revisions?.length ?? 0) > 0 && (
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 text-sm">
               <span className="font-semibold block mb-2">Superseded By:</span>
               <ul className="space-y-1">
                 {quote.revisions?.map((rev: { id: string; quoteNumber: string }) => (
                    <li key={String(rev.id)}>
                       <a href={`/quotes/${rev.id}`} className="text-blue-600 hover:underline">
                          {String(rev.quoteNumber)}
                       </a>
                    </li>
                 ))}
               </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
