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

type ProductFormValue = {
  id?: string;
  sku?: string;
  name?: string;
  description?: string | null;
  family?: string | null;
  isLabor?: boolean;
  taxable?: boolean;
  active?: boolean;
  defaultUnitPrice?: number | string | null;
  defaultCost?: number | string | null;
};

type ProductFormProps = {
  initial?: ProductFormValue;
  canMutate: boolean;
};

export function ProductForm({ initial, canMutate }: ProductFormProps) {
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
      sku: optionalString(formData.get("sku")),
      name: optionalString(formData.get("name")),
      description: optionalString(formData.get("description")),
      family: optionalString(formData.get("family")),
      isLabor: formData.get("isLabor") === "on",
      taxable: formData.get("taxable") === "on",
      active: formData.get("active") === "on",
      defaultUnitPrice: numericField(formData.get("defaultUnitPrice")),
      defaultCost: numericField(formData.get("defaultCost")),
    };

    const response = await apiFetch(isEditing ? `/api/products/${initial?.id}` : "/api/products", {
      method: isEditing ? "PATCH" : "POST",
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Unable to save product.");
      setIsSaving(false);
      return;
    }

    const data = (await response.json()) as { product: { id: string } };

    if (isEditing) {
      router.refresh();
    } else {
      router.push(`/catalog/products/${data.product.id}`);
      router.refresh();
    }

    setIsSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <FormError message={error} />
      {!canMutate ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200">
          Your role can view the catalog but cannot make changes.
        </p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="SKU">
          <input
            name="sku"
            defaultValue={initial?.sku ?? ""}
            disabled={!canMutate}
            required={canMutate}
            className={inputClassName}
          />
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
        <Field label="Family">
          <input
            name="family"
            defaultValue={initial?.family ?? ""}
            disabled={!canMutate}
            placeholder="Fluids, Brakes, Labor, ..."
            className={inputClassName}
          />
        </Field>
        <Field label="Default Unit Price">
          <input
            name="defaultUnitPrice"
            type="number"
            step="0.0001"
            min="0"
            defaultValue={toInputNumber(initial?.defaultUnitPrice)}
            disabled={!canMutate}
            className={inputClassName}
          />
        </Field>
        <Field label="Default Cost">
          <input
            name="defaultCost"
            type="number"
            step="0.0001"
            min="0"
            defaultValue={toInputNumber(initial?.defaultCost)}
            disabled={!canMutate}
            className={inputClassName}
          />
        </Field>
        <div className="flex flex-col gap-2 self-end text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="isLabor"
              defaultChecked={initial?.isLabor ?? false}
              disabled={!canMutate}
            />
            <span>Labor operation (non-inventory)</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="taxable"
              defaultChecked={initial?.taxable ?? true}
              disabled={!canMutate}
            />
            <span>Taxable</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="active"
              defaultChecked={initial?.active ?? true}
              disabled={!canMutate}
            />
            <span>Active in catalog</span>
          </label>
        </div>
      </div>
      <Field label="Description">
        <textarea
          name="description"
          defaultValue={initial?.description ?? ""}
          disabled={!canMutate}
          className={`${inputClassName} min-h-24`}
        />
      </Field>
      {canMutate ? (
        <button type="submit" disabled={isSaving} className={primaryButtonClassName}>
          {isSaving ? "Saving..." : isEditing ? "Save product" : "Create product"}
        </button>
      ) : null}
    </form>
  );
}

function optionalString(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";

  return text.length > 0 ? text : null;
}

function numericField(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";

  if (text === "") {
    return null;
  }

  const parsed = Number(text);

  return Number.isFinite(parsed) ? parsed : null;
}

function toInputNumber(value: number | string | null | undefined) {
  if (value == null || value === "") {
    return "";
  }

  if (typeof value === "number") {
    return value.toString();
  }

  return String(value);
}
