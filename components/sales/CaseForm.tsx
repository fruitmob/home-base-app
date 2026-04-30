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

type CaseFormValue = {
  id?: string;
  customerId?: string;
  vehicleId?: string | null;
  assignedUserId?: string | null;
  status?: "OPEN" | "WAITING" | "RESOLVED" | "CANCELED";
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  subject?: string;
  description?: string | null;
  resolutionNotes?: string | null;
};

type SelectOption = {
  id: string;
  label: string;
};

type CaseFormProps = {
  initial?: CaseFormValue;
  canMutate: boolean;
  customers: SelectOption[];
  vehicles: SelectOption[];
  users: SelectOption[];
};

export function CaseForm({
  initial,
  canMutate,
  customers,
  vehicles,
  users,
}: CaseFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState(initial?.resolutionNotes ?? "");
  const isEditing = Boolean(initial?.id);
  const isResolved = initial?.status === "RESOLVED";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canMutate) {
      return;
    }

    setError(null);
    setIsSaving(true);

    const formData = new FormData(event.currentTarget);
    const payload = {
      customerId: formData.get("customerId"),
      vehicleId: optionalString(formData.get("vehicleId")),
      assignedUserId: optionalString(formData.get("assignedUserId")),
      status: formData.get("status"),
      priority: formData.get("priority"),
      subject: formData.get("subject"),
      description: optionalString(formData.get("description")),
    };

    const response = await apiFetch(isEditing ? `/api/cases/${initial?.id}` : "/api/cases", {
      method: isEditing ? "PATCH" : "POST",
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Unable to save case.");
      setIsSaving(false);
      return;
    }

    const data = (await response.json()) as { case: { id: string } };

    if (isEditing) {
      router.refresh();
    } else {
      router.push(`/cases/${data.case.id}`);
      router.refresh();
    }

    setIsSaving(false);
  }

  async function handleResolve() {
    if (!initial?.id || !canMutate) {
      return;
    }

    setError(null);
    setIsSaving(true);

    const response = await apiFetch(`/api/cases/${initial.id}/resolve`, {
      method: "POST",
      body: JSON.stringify({ resolutionNotes }),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Unable to resolve case.");
      setIsSaving(false);
      return;
    }

    router.refresh();
    setIsSaving(false);
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <FormError message={error} />
        {!canMutate ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200">
            Your role can view this case but cannot make changes.
          </p>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Customer">
            <select
              name="customerId"
              defaultValue={initial?.customerId ?? ""}
              disabled={!canMutate}
              required
              className={inputClassName}
            >
              <option value="" disabled>Select a customer...</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Vehicle">
            <select
              name="vehicleId"
              defaultValue={initial?.vehicleId ?? ""}
              disabled={!canMutate}
              className={inputClassName}
            >
              <option value="">No vehicle</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Assigned To">
            <select
              name="assignedUserId"
              defaultValue={initial?.assignedUserId ?? ""}
              disabled={!canMutate}
              className={inputClassName}
            >
              <option value="">Unassigned</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Status">
            <select
              name="status"
              defaultValue={initial?.status ?? "OPEN"}
              disabled={!canMutate}
              className={inputClassName}
            >
              {["OPEN", "WAITING", "RESOLVED", "CANCELED"].map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Priority">
            <select
              name="priority"
              defaultValue={initial?.priority ?? "NORMAL"}
              disabled={!canMutate}
              className={inputClassName}
            >
              {["LOW", "NORMAL", "HIGH", "URGENT"].map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Subject">
            <input
              name="subject"
              defaultValue={initial?.subject ?? ""}
              disabled={!canMutate}
              required
              className={inputClassName}
            />
          </Field>
        </div>

        <Field label="Description">
          <textarea
            name="description"
            defaultValue={initial?.description ?? ""}
            disabled={!canMutate}
            className={`${inputClassName} min-h-32`}
          />
        </Field>

        {canMutate ? (
          <button type="submit" disabled={isSaving} className={primaryButtonClassName}>
            {isSaving ? "Saving..." : isEditing ? "Save case" : "Create case"}
          </button>
        ) : null}
      </form>

      {isEditing ? (
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950">
          <Field label="Resolution Notes">
            <textarea
              value={resolutionNotes}
              onChange={(event) => setResolutionNotes(event.target.value)}
              disabled={!canMutate || isResolved}
              className={`${inputClassName} min-h-24`}
              placeholder={isResolved ? "Case is resolved." : "Summarize the fix or customer outcome."}
            />
          </Field>
          {canMutate && !isResolved ? (
            <button
              type="button"
              onClick={handleResolve}
              disabled={isSaving}
              className={`${secondaryButtonClassName} mt-4`}
            >
              {isSaving ? "Resolving..." : "Resolve case"}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function optionalString(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text : null;
}
