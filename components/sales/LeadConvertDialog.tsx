"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import {
  Field,
  FormError,
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/components/core/FormShell";

type LeadConvertDialogProps = {
  leadId: string;
  defaultOpportunityName: string;
  defaultExpectedAmount: number | null;
};

export function LeadConvertDialog({
  leadId,
  defaultOpportunityName,
  defaultExpectedAmount,
}: LeadConvertDialogProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [createCustomer, setCreateCustomer] = useState(true);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError(null);
    setIsSaving(true);

    const formData = new FormData(event.currentTarget);
    const payload = {
      createCustomer: createCustomer,
      customerId: createCustomer ? null : optionalString(formData.get("customerId")),
      opportunityName: optionalString(formData.get("opportunityName")),
      opportunityAmount: numericField(formData.get("opportunityAmount")),
      opportunityStage: formData.get("opportunityStage"),
      opportunityExpectedCloseDate: optionalString(formData.get("opportunityExpectedCloseDate")) 
        ? new Date(formData.get("opportunityExpectedCloseDate") as string).toISOString() 
        : null,
      opportunityNotes: optionalString(formData.get("opportunityNotes")),
    };

    const response = await apiFetch(`/api/leads/${leadId}/convert`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Unable to convert lead.");
      setIsSaving(false);
      return;
    }

    const data = (await response.json()) as { opportunity: { id: string } };
    
    // Redirect to the new Opportunity
    router.push(`/sales/opportunities/${data.opportunity.id}`);
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl dark:bg-slate-900 border dark:border-slate-800 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4 dark:text-white">Convert Lead</h2>
        <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
          This will map the lead into a permanent Customer account and open a new active Sales Opportunity. This action is terminal for the lead status.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <FormError message={error} />
          
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-4">
            <h3 className="font-semibold dark:text-slate-200">Customer Resolution</h3>
            <div className="flex items-center gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="customerResolution"
                  checked={createCustomer}
                  onChange={() => setCreateCustomer(true)}
                />
                <span className="dark:text-slate-300">Create new customer</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="customerResolution"
                  checked={!createCustomer}
                  onChange={() => setCreateCustomer(false)}
                />
                <span className="dark:text-slate-300">Match existing customer</span>
              </label>
            </div>

            {!createCustomer && (
              <Field label="Customer ID">
                <input
                  name="customerId"
                  required
                  placeholder="Enter specific Customer ID"
                  className={inputClassName}
                />
              </Field>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-4">
            <h3 className="font-semibold dark:text-slate-200">New Opportunity Configuration</h3>
            <Field label="Opportunity Name">
              <input
                name="opportunityName"
                defaultValue={defaultOpportunityName}
                required
                className={inputClassName}
              />
            </Field>
            <Field label="Opportunity Stage">
              <select
                name="opportunityStage"
                defaultValue="NEW"
                required
                className={inputClassName}
              >
                {["NEW", "WORKING", "QUOTED", "PENDING"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Pipeline Amount">
              <input
                name="opportunityAmount"
                type="number"
                step="0.01"
                min="0"
                defaultValue={defaultExpectedAmount ? defaultExpectedAmount.toString() : ""}
                required
                className={inputClassName}
              />
            </Field>
            <Field label="Expected Close Date">
              <input
                name="opportunityExpectedCloseDate"
                type="date"
                className={inputClassName}
              />
            </Field>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t dark:border-slate-800">
            <button
              type="button"
              onClick={() => router.push(`/sales/leads/${leadId}`)}
              className={secondaryButtonClassName}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button type="submit" disabled={isSaving} className={primaryButtonClassName}>
              {isSaving ? "Converting..." : "Convert Lead"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function optionalString(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text : null;
}

function numericField(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  if (text === "") return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}
