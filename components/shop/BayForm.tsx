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

type BayFormValue = {
  id?: string;
  name?: string;
  description?: string | null;
  active?: boolean;
  sortOrder?: number;
};

type BayFormProps = {
  initial?: BayFormValue;
};

export function BayForm({ initial }: BayFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isEditing = Boolean(initial?.id);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    const formData = new FormData(event.currentTarget);
    const sortOrderRaw = formData.get("sortOrder") as string;
    
    const payload = {
      name: formData.get("name"),
      description: optionalString(formData.get("description")),
      active: formData.get("active") === "true",
      sortOrder: sortOrderRaw ? parseInt(sortOrderRaw, 10) : 0,
    };

    const response = await apiFetch(isEditing ? `/api/bays/${initial?.id}` : "/api/bays", {
      method: isEditing ? "PATCH" : "POST",
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Unable to save bay.");
      setIsSaving(false);
      return;
    }

    router.push("/shop/bays");
    router.refresh();
    setIsSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <FormError message={error} />

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name">
          <input
            name="name"
            defaultValue={initial?.name ?? ""}
            required
            className={inputClassName}
          />
        </Field>

        <Field label="Status">
          <select
            name="active"
            defaultValue={initial?.active === false ? "false" : "true"}
            className={inputClassName}
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </Field>

        <Field label="Sort Order">
          <input
            name="sortOrder"
            type="number"
            min="0"
            step="1"
            defaultValue={initial?.sortOrder ?? 0}
            className={inputClassName}
          />
        </Field>
      </div>

      <Field label="Description">
        <textarea
          name="description"
          defaultValue={initial?.description ?? ""}
          className={`${inputClassName} min-h-24`}
        />
      </Field>

      <div className="flex gap-4">
        <button type="submit" disabled={isSaving} className={primaryButtonClassName}>
          {isSaving ? "Saving..." : isEditing ? "Save bay" : "Create bay"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/shop/bays")}
          disabled={isSaving}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function optionalString(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text : null;
}
