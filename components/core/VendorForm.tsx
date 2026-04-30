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

type VendorFormValue = {
  id?: string;
  vendorType?: string;
  name?: string;
  accountNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  defaultPaymentTerms?: string | null;
  taxId?: string | null;
  notes?: string | null;
};

type VendorFormProps = {
  initial?: VendorFormValue;
  canMutate: boolean;
};

export function VendorForm({ initial, canMutate }: VendorFormProps) {
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
      vendorType: String(formData.get("vendorType") || "PARTS"),
      name: optionalString(formData.get("name")),
      accountNumber: optionalString(formData.get("accountNumber")),
      email: optionalString(formData.get("email")),
      phone: optionalString(formData.get("phone")),
      website: optionalString(formData.get("website")),
      defaultPaymentTerms: optionalString(formData.get("defaultPaymentTerms")),
      taxId: optionalString(formData.get("taxId")),
      notes: optionalString(formData.get("notes")),
    };

    const response = await apiFetch(isEditing ? `/api/vendors/${initial?.id}` : "/api/vendors", {
      method: isEditing ? "PATCH" : "POST",
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Unable to save vendor.");
      setIsSaving(false);
      return;
    }

    const data = (await response.json()) as { vendor: { id: string } };

    if (isEditing) {
      router.refresh();
    } else {
      router.push(`/vendors/${data.vendor.id}`);
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <FormError message={error} />
      {!canMutate ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200">
          Your role can view this vendor but cannot make changes.
        </p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Vendor Type">
          <select
            name="vendorType"
            defaultValue={initial?.vendorType ?? "PARTS"}
            disabled={!canMutate}
            className={inputClassName}
          >
            <option value="PARTS">Parts</option>
            <option value="SERVICE">Service</option>
            <option value="BOTH">Both</option>
            <option value="OTHER">Other</option>
          </select>
        </Field>
        <Field label="Name">
          <input
            name="name"
            defaultValue={initial?.name ?? ""}
            disabled={!canMutate}
            required={canMutate}
            className={inputClassName}
          />
        </Field>
        <Field label="Account Number">
          <input
            name="accountNumber"
            defaultValue={initial?.accountNumber ?? ""}
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
        <Field label="Tax ID">
          <input
            name="taxId"
            defaultValue={initial?.taxId ?? ""}
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
          className={`${inputClassName} min-h-28`}
        />
      </Field>
      {canMutate ? (
        <button type="submit" disabled={isSaving} className={primaryButtonClassName}>
          {isSaving ? "Saving..." : isEditing ? "Save vendor" : "Create vendor"}
        </button>
      ) : null}
    </form>
  );
}

function optionalString(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";

  return text.length > 0 ? text : null;
}
