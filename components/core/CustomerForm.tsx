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

type CustomerFormValue = {
  id?: string;
  customerType?: string;
  displayName?: string;
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  taxExempt?: boolean;
  taxExemptId?: string | null;
  defaultPaymentTerms?: string | null;
  isWalkIn?: boolean;
  notes?: string | null;
};

type CustomerFormProps = {
  initial?: CustomerFormValue;
  canMutate: boolean;
  compact?: boolean;
};

export function CustomerForm({ initial, canMutate, compact = false }: CustomerFormProps) {
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
      customerType: String(formData.get("customerType") || "BUSINESS"),
      displayName: optionalString(formData.get("displayName")),
      companyName: optionalString(formData.get("companyName")),
      firstName: optionalString(formData.get("firstName")),
      lastName: optionalString(formData.get("lastName")),
      email: optionalString(formData.get("email")),
      phone: optionalString(formData.get("phone")),
      website: optionalString(formData.get("website")),
      taxExempt: formData.get("taxExempt") === "on",
      taxExemptId: optionalString(formData.get("taxExemptId")),
      defaultPaymentTerms: optionalString(formData.get("defaultPaymentTerms")),
      isWalkIn: formData.get("isWalkIn") === "on",
      notes: optionalString(formData.get("notes")),
    };

    const response = await apiFetch(isEditing ? `/api/customers/${initial?.id}` : "/api/customers", {
      method: isEditing ? "PATCH" : "POST",
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Unable to save customer.");
      setIsSaving(false);
      return;
    }

    const data = (await response.json()) as { customer: { id: string } };

    if (isEditing) {
      router.refresh();
    } else {
      router.push(`/customers/${data.customer.id}`);
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className={compact ? "space-y-4" : "space-y-5"}>
      <FormError message={error} />
      {!canMutate ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200">
          Your role can view this record but cannot make changes.
        </p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Customer Type">
          <select
            name="customerType"
            defaultValue={initial?.customerType ?? "BUSINESS"}
            disabled={!canMutate}
            className={inputClassName}
          >
            <option value="BUSINESS">Business</option>
            <option value="INDIVIDUAL">Individual</option>
          </select>
        </Field>
        <Field label="Display Name">
          <input
            name="displayName"
            defaultValue={initial?.displayName ?? ""}
            disabled={!canMutate}
            className={inputClassName}
            placeholder="Auto-created if blank"
          />
        </Field>
        <Field label="Company">
          <input
            name="companyName"
            defaultValue={initial?.companyName ?? ""}
            disabled={!canMutate}
            className={inputClassName}
            placeholder="Company or fleet name"
          />
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
            defaultValue={initial?.phone ?? ""}
            disabled={!canMutate}
            className={inputClassName}
          />
        </Field>
        <Field label="Website">
          <input
            name="website"
            defaultValue={initial?.website ?? ""}
            disabled={!canMutate}
            className={inputClassName}
          />
        </Field>
        <Field label="Payment Terms">
          <input
            name="defaultPaymentTerms"
            defaultValue={initial?.defaultPaymentTerms ?? ""}
            disabled={!canMutate}
            className={inputClassName}
            placeholder="Net 30"
          />
        </Field>
        <Field label="Tax Exempt ID">
          <input
            name="taxExemptId"
            defaultValue={initial?.taxExemptId ?? ""}
            disabled={!canMutate}
            className={inputClassName}
          />
        </Field>
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <input
            name="taxExempt"
            type="checkbox"
            defaultChecked={initial?.taxExempt ?? false}
            disabled={!canMutate}
            className="h-4 w-4 rounded border-slate-300"
          />
          Tax exempt
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <input
            name="isWalkIn"
            type="checkbox"
            defaultChecked={initial?.isWalkIn ?? false}
            disabled={!canMutate}
            className="h-4 w-4 rounded border-slate-300"
          />
          Walk-in customer
        </label>
      </div>
      <Field label="Notes">
        <textarea
          name="notes"
          defaultValue={initial?.notes ?? ""}
          disabled={!canMutate}
          className={`${inputClassName} min-h-28`}
        />
      </Field>
      {canMutate ? (
        <button type="submit" disabled={isSaving} className={primaryButtonClassName}>
          {isSaving ? "Saving..." : isEditing ? "Save customer" : "Create customer"}
        </button>
      ) : null}
    </form>
  );
}

function optionalString(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";

  return text.length > 0 ? text : null;
}
