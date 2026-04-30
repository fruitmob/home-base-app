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

type PricebookFormValue = {
  id?: string;
  name?: string;
  description?: string | null;
  isDefault?: boolean;
  active?: boolean;
};

type PricebookFormProps = {
  initial?: PricebookFormValue;
  canMutate: boolean;
};

export function PricebookForm({ initial, canMutate }: PricebookFormProps) {
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
      name: optionalString(formData.get("name")),
      description: optionalString(formData.get("description")),
      isDefault: formData.get("isDefault") === "on",
      active: formData.get("active") === "on",
    };

    const response = await apiFetch(
      isEditing ? `/api/pricebooks/${initial?.id}` : "/api/pricebooks",
      {
        method: isEditing ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Unable to save pricebook.");
      setIsSaving(false);
      return;
    }

    const data = (await response.json()) as { pricebook: { id: string } };

    if (isEditing) {
      router.refresh();
    } else {
      router.push(`/catalog/pricebooks/${data.pricebook.id}`);
      router.refresh();
    }

    setIsSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <FormError message={error} />
      {!canMutate ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200">
          Your role can view pricebooks but cannot make changes.
        </p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name">
          <input
            name="name"
            defaultValue={initial?.name ?? ""}
            disabled={!canMutate}
            required={canMutate}
            className={inputClassName}
          />
        </Field>
        <div className="flex flex-col gap-2 self-end text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="isDefault"
              defaultChecked={initial?.isDefault ?? false}
              disabled={!canMutate}
            />
            <span>Default pricebook for the shop</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="active"
              defaultChecked={initial?.active ?? true}
              disabled={!canMutate}
            />
            <span>Active (available to quotes)</span>
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
          {isSaving ? "Saving..." : isEditing ? "Save pricebook" : "Create pricebook"}
        </button>
      ) : null}
    </form>
  );
}

function optionalString(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";

  return text.length > 0 ? text : null;
}
