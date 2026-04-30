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

type SalesGoalFormValue = {
  id?: string;
  userId?: string;
  period?: string;
  targetAmount?: number | string;
  notes?: string | null;
};

type SelectOption = {
  id: string;
  label: string;
};

export function SalesGoalForm({
  initial,
  users,
  canMutate,
}: {
  initial?: SalesGoalFormValue;
  users: SelectOption[];
  canMutate: boolean;
}) {
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

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      userId: formData.get("userId"),
      period: formData.get("period"),
      targetAmount: numericField(formData.get("targetAmount")),
      notes: optionalString(formData.get("notes")),
    };

    const response = await apiFetch(isEditing ? `/api/sales-goals/${initial?.id}` : "/api/sales-goals", {
      method: isEditing ? "PATCH" : "POST",
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Unable to save sales goal.");
      setIsSaving(false);
      return;
    }

    if (!isEditing) {
      form.reset();
    }

    router.refresh();
    setIsSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <FormError message={error} />
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="User">
          <select
            name="userId"
            defaultValue={initial?.userId ?? ""}
            disabled={!canMutate}
            required
            className={inputClassName}
          >
            <option value="" disabled>Select a user...</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Period">
          <input
            name="period"
            type="month"
            defaultValue={initial?.period ?? currentPeriod()}
            disabled={!canMutate}
            required
            className={inputClassName}
          />
        </Field>

        <Field label="Target Amount">
          <input
            name="targetAmount"
            type="number"
            step="0.01"
            min="0"
            defaultValue={toInputNumber(initial?.targetAmount)}
            disabled={!canMutate}
            required
            className={inputClassName}
          />
        </Field>
      </div>

      <Field label="Notes">
        <textarea
          name="notes"
          defaultValue={initial?.notes ?? ""}
          disabled={!canMutate}
          className={`${inputClassName} min-h-20`}
        />
      </Field>

      {canMutate ? (
        <button type="submit" disabled={isSaving} className={primaryButtonClassName}>
          {isSaving ? "Saving..." : isEditing ? "Save goal" : "Create goal"}
        </button>
      ) : null}
    </form>
  );
}

function currentPeriod() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
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
