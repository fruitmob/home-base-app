"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { LeadStatus, LeadSource } from "@/generated/prisma/client";
import {
  Field,
  FormError,
  inputClassName,
  primaryButtonClassName,
} from "@/components/core/FormShell";

type LeadFormValue = {
  id?: string;
  status?: LeadStatus;
  source?: LeadSource;
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  email?: string | null;
  phone?: string | null;
  interest?: string | null;
  estimatedValue?: number | string | null;
  notes?: string | null;
  ownerUserId?: string | null;
};

type LeadFormProps = {
  initial?: LeadFormValue;
  canMutate: boolean;
};

export function LeadForm({ initial, canMutate }: LeadFormProps) {
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
      status: formData.get("status"),
      source: formData.get("source"),
      companyName: optionalString(formData.get("companyName")),
      firstName: optionalString(formData.get("firstName")),
      lastName: optionalString(formData.get("lastName")),
      displayName: optionalString(formData.get("displayName")),
      email: optionalString(formData.get("email")),
      phone: optionalString(formData.get("phone")),
      interest: optionalString(formData.get("interest")),
      estimatedValue: numericField(formData.get("estimatedValue")),
      notes: optionalString(formData.get("notes")),
      ownerUserId: optionalString(formData.get("ownerUserId")),
    };

    const response = await apiFetch(isEditing ? `/api/leads/${initial?.id}` : "/api/leads", {
      method: isEditing ? "PATCH" : "POST",
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Unable to save lead.");
      setIsSaving(false);
      return;
    }

    const data = (await response.json()) as { lead: { id: string } };

    if (isEditing) {
      router.refresh();
    } else {
      router.push(`/sales/leads/${data.lead.id}`);
      router.refresh();
    }

    setIsSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <FormError message={error} />
      {!canMutate ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200">
          Your role cannot modify this lead.
        </p>
      ) : null}
      
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Status">
          <select
            name="status"
            defaultValue={initial?.status ?? "NEW"}
            disabled={!canMutate}
            required
            className={inputClassName}
          >
            {["NEW", "WORKING", "QUALIFIED", "CONVERTED", "UNQUALIFIED"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Source">
          <select
            name="source"
            defaultValue={initial?.source ?? "OTHER"}
            disabled={!canMutate}
            required
            className={inputClassName}
          >
            {["WEBSITE_ORGANIC", "WEBSITE_AD", "MANUFACTURER", "TRADESHOW", "REFERRAL", "COLD_CALL", "OTHER"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Field>

        <Field label="First Name">
          <input
            name="firstName"
            defaultValue={initial?.firstName ?? ""}
            disabled={!canMutate}
            className={inputClassName}
          />
        </Field>
        <Field label="Last Name">
          <input
            name="lastName"
            defaultValue={initial?.lastName ?? ""}
            disabled={!canMutate}
            className={inputClassName}
          />
        </Field>

        <Field label="Company Name">
          <input
            name="companyName"
            defaultValue={initial?.companyName ?? ""}
            disabled={!canMutate}
            className={inputClassName}
          />
        </Field>
        <Field label="Display Name">
          <input
            name="displayName"
            defaultValue={initial?.displayName ?? ""}
            disabled={!canMutate}
            placeholder="Auto-generated if left blank"
            className={inputClassName}
          />
        </Field>

        <Field label="Email">
          <input
            name="email"
            type="email"
            defaultValue={initial?.email ?? ""}
            disabled={!canMutate}
            className={inputClassName}
          />
        </Field>
        <Field label="Phone">
          <input
            name="phone"
            type="tel"
            defaultValue={initial?.phone ?? ""}
            disabled={!canMutate}
            className={inputClassName}
          />
        </Field>

        <Field label="Interest">
          <input
            name="interest"
            defaultValue={initial?.interest ?? ""}
            disabled={!canMutate}
            className={inputClassName}
          />
        </Field>
        <Field label="Estimated Value">
          <input
            name="estimatedValue"
            type="number"
            step="0.01"
            min="0"
            defaultValue={toInputNumber(initial?.estimatedValue)}
            disabled={!canMutate}
            className={inputClassName}
          />
        </Field>

        <Field label="Owner User ID">
          <input
            name="ownerUserId"
            defaultValue={initial?.ownerUserId ?? ""}
            disabled={!canMutate}
            placeholder="Assign to a user ID"
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
          {isSaving ? "Saving..." : isEditing ? "Save details" : "Create lead"}
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
