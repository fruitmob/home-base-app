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

type VehicleFormValue = {
  id?: string;
  customerId?: string;
  vin?: string | null;
  year?: number | null;
  make?: string | null;
  model?: string | null;
  trim?: string | null;
  unitNumber?: string | null;
  licensePlate?: string | null;
  licenseState?: string | null;
  currentMileage?: number | null;
  color?: string | null;
  notes?: string | null;
};

type CustomerOption = {
  id: string;
  displayName: string;
};

type VehicleFormProps = {
  initial?: VehicleFormValue;
  customers: CustomerOption[];
  canMutate: boolean;
  lockedCustomerId?: string;
};

export function VehicleForm({
  initial,
  customers,
  canMutate,
  lockedCustomerId,
}: VehicleFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isEditing = Boolean(initial?.id);
  const defaultCustomerId = lockedCustomerId ?? initial?.customerId ?? customers[0]?.id ?? "";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canMutate) {
      return;
    }

    setError(null);
    setIsSaving(true);

    const formData = new FormData(event.currentTarget);
    const payload = {
      customerId: lockedCustomerId ?? optionalString(formData.get("customerId")),
      vin: optionalString(formData.get("vin")),
      year: optionalNumber(formData.get("year")),
      make: optionalString(formData.get("make")),
      model: optionalString(formData.get("model")),
      trim: optionalString(formData.get("trim")),
      unitNumber: optionalString(formData.get("unitNumber")),
      licensePlate: optionalString(formData.get("licensePlate")),
      licenseState: optionalString(formData.get("licenseState")),
      currentMileage: optionalNumber(formData.get("currentMileage")),
      mileageNote: optionalString(formData.get("mileageNote")),
      color: optionalString(formData.get("color")),
      notes: optionalString(formData.get("notes")),
    };

    const response = await apiFetch(isEditing ? `/api/vehicles/${initial?.id}` : "/api/vehicles", {
      method: isEditing ? "PATCH" : "POST",
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Unable to save vehicle.");
      setIsSaving(false);
      return;
    }

    const data = (await response.json()) as { vehicle: { id: string } };

    if (isEditing) {
      router.refresh();
    } else {
      router.push(`/vehicles/${data.vehicle.id}`);
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <FormError message={error} />
      {!canMutate ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200">
          Your role can view this vehicle but cannot make changes.
        </p>
      ) : null}
      {customers.length === 0 && !isEditing ? (
        <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
          Create a customer before adding vehicles.
        </p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Customer">
          <select
            name="customerId"
            defaultValue={defaultCustomerId}
            disabled={!canMutate || Boolean(lockedCustomerId) || isEditing}
            className={inputClassName}
          >
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.displayName}
              </option>
            ))}
          </select>
        </Field>
        <Field label="VIN">
          <input
            name="vin"
            defaultValue={initial?.vin ?? ""}
            disabled={!canMutate}
            className={inputClassName}
            placeholder="17-character VIN"
          />
        </Field>
        <Field label="Year">
          <input
            name="year"
            type="number"
            min="1886"
            max="2100"
            defaultValue={initial?.year ?? ""}
            disabled={!canMutate}
            className={inputClassName}
          />
        </Field>
        <Field label="Make">
          <input
            name="make"
            defaultValue={initial?.make ?? ""}
            disabled={!canMutate}
            className={inputClassName}
          />
        </Field>
        <Field label="Model">
          <input
            name="model"
            defaultValue={initial?.model ?? ""}
            disabled={!canMutate}
            className={inputClassName}
          />
        </Field>
        <Field label="Trim">
          <input
            name="trim"
            defaultValue={initial?.trim ?? ""}
            disabled={!canMutate}
            className={inputClassName}
          />
        </Field>
        <Field label="Unit Number">
          <input
            name="unitNumber"
            defaultValue={initial?.unitNumber ?? ""}
            disabled={!canMutate}
            className={inputClassName}
          />
        </Field>
        <Field label="Color">
          <input
            name="color"
            defaultValue={initial?.color ?? ""}
            disabled={!canMutate}
            className={inputClassName}
          />
        </Field>
        <Field label="License Plate">
          <input
            name="licensePlate"
            defaultValue={initial?.licensePlate ?? ""}
            disabled={!canMutate}
            className={inputClassName}
          />
        </Field>
        <Field label="License State">
          <input
            name="licenseState"
            maxLength={2}
            defaultValue={initial?.licenseState ?? ""}
            disabled={!canMutate}
            className={inputClassName}
          />
        </Field>
        <Field label="Current Mileage">
          <input
            name="currentMileage"
            type="number"
            min="0"
            defaultValue={initial?.currentMileage ?? ""}
            disabled={!canMutate}
            className={inputClassName}
          />
        </Field>
        <Field label="Mileage Note">
          <input
            name="mileageNote"
            disabled={!canMutate}
            className={inputClassName}
            placeholder="Optional note when mileage changes"
          />
        </Field>
      </div>
      <Field label="Vehicle Notes">
        <textarea
          name="notes"
          defaultValue={initial?.notes ?? ""}
          disabled={!canMutate}
          className={`${inputClassName} min-h-28`}
        />
      </Field>
      {canMutate ? (
        <button
          type="submit"
          disabled={isSaving || (!isEditing && customers.length === 0)}
          className={primaryButtonClassName}
        >
          {isSaving ? "Saving..." : isEditing ? "Save vehicle" : "Create vehicle"}
        </button>
      ) : null}
    </form>
  );
}

function optionalString(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";

  return text.length > 0 ? text : null;
}

function optionalNumber(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";

  if (!text) {
    return null;
  }

  const number = Number(text);

  return Number.isFinite(number) ? number : null;
}
