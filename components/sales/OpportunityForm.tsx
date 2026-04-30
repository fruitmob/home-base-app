"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import {
  Field,
  FormError,
  inputClassName,
  primaryButtonClassName,
} from "@/components/core/FormShell";

export type OpportunityStageString = "NEW" | "QUALIFIED" | "PROPOSAL" | "NEGOTIATION" | "WON" | "LOST";

type OpportunityFormValue = {
  id?: string;
  name?: string;
  customerId?: string;
  vehicleId?: string | null;
  ownerUserId?: string | null;
  amount?: number | string;
  probability?: number | string;
  expectedCloseDate?: Date | string | null;
  notes?: string | null;
  stage?: OpportunityStageString;
};

type OpportunityFormProps = {
  initial?: OpportunityFormValue;
  canMutate: boolean;
};

export function OpportunityForm({ initial, canMutate }: OpportunityFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isEditing = Boolean(initial?.id);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canMutate) {
      return;
    }

    setError(null);
    setIsSaving(true);

    const formData = new FormData(event.currentTarget);
    const payload = {
      name: formData.get("name"),
      customerId: formData.get("customerId"),
      vehicleId: optionalString(formData.get("vehicleId")),
      ownerUserId: optionalString(formData.get("ownerUserId")),
      amount: numericField(formData.get("amount")),
      probability: numericField(formData.get("probability")),
      expectedCloseDate: formData.get("expectedCloseDate") || null,
      notes: optionalString(formData.get("notes")),
    } as Record<string, unknown>;
    
    // Only pass stage during creation if present
    if (!isEditing && formData.has("stage")) {
      payload.stage = formData.get("stage");
    }

    const response = await apiFetch(isEditing ? `/api/opportunities/${initial?.id}` : "/api/opportunities", {
      method: isEditing ? "PATCH" : "POST",
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Unable to save opportunity.");
      setIsSaving(false);
      return;
    }

    const data = (await response.json()) as { id: string };

    if (isEditing) {
      router.refresh();
    } else {
      router.push(`/sales/opportunities/${data.id}`);
      router.refresh();
    }

    setIsSaving(false);
  }
  
  function getFormattedDate(val: Date | string | null | undefined) {
    if (!val) return "";
    try {
      const d = new Date(val);
      return d.toISOString().split("T")[0];
    } catch {
      return String(val);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <FormError message={error} />
      {!canMutate ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200">
          Your role cannot modify this opportunity.
        </p>
      ) : null}
      
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Opportunity Name">
          <input
            name="name"
            defaultValue={initial?.name ?? ""}
            disabled={!canMutate}
            required
            className={inputClassName}
          />
        </Field>
        
        <Field label="Customer ID">
          <input
            name="customerId"
            defaultValue={initial?.customerId ?? ""}
            disabled={!canMutate}
            placeholder="Link to customer..."
            required
            className={inputClassName}
          />
        </Field>

        <Field label="Amount">
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0"
            defaultValue={toInputNumber(initial?.amount)}
            disabled={!canMutate}
            className={inputClassName}
          />
        </Field>

        <Field label="Probability (%)">
          <input
            name="probability"
            type="number"
            step="1"
            min="0"
            max="100"
            defaultValue={toInputNumber(initial?.probability)}
            disabled={!canMutate}
            className={inputClassName}
          />
        </Field>

        <Field label="Expected Close Date">
          <input
            name="expectedCloseDate"
            type="date"
            defaultValue={getFormattedDate(initial?.expectedCloseDate)}
            disabled={!canMutate}
            className={inputClassName}
          />
        </Field>

        <Field label="Stage">
          <select
            name="stage"
            defaultValue={initial?.stage ?? "NEW"}
            disabled={!canMutate || isEditing}
            className={inputClassName}
          >
            {["NEW", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {isEditing && <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">Change stage via pipeline drag-and-drop.</p>}
        </Field>

        <Field label="Vehicle ID (Optional)">
          <input
            name="vehicleId"
            defaultValue={initial?.vehicleId ?? ""}
            disabled={!canMutate}
            className={inputClassName}
          />
        </Field>

        <Field label="Owner User ID">
          <input
            name="ownerUserId"
            defaultValue={initial?.ownerUserId ?? ""}
            disabled={!canMutate}
            className={inputClassName}
          />
        </Field>
      </div>

      <Field label="Notes">
        <textarea
          name="notes"
          defaultValue={initial?.notes ?? ""}
          disabled={!canMutate}
          className={`${inputClassName} min-h-32`}
        />
      </Field>

      {canMutate && (
        <button type="submit" disabled={isSaving} className={primaryButtonClassName}>
          {isSaving ? "Saving..." : isEditing ? "Save details" : "Create opportunity"}
        </button>
      )}
    </form>
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

function toInputNumber(value: number | string | null | undefined) {
  if (value == null || value === "") return "";
  if (typeof value === "number") return value.toString();
  return String(value);
}
