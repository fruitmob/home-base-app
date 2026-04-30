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

type CustomerOption = {
  id: string;
  displayName: string;
};

type VehicleOption = {
  id: string;
  customerId: string;
  year: number | null;
  make: string | null;
  model: string | null;
  unitNumber: string | null;
};

type UserOption = {
  id: string;
  email: string;
  role: string;
};

type BayOption = {
  id: string;
  name: string;
};

type WorkOrderFormValue = {
  id?: string;
  customerId?: string;
  vehicleId?: string | null;
  opportunityId?: string | null;
  quoteId?: string | null;
  bayId?: string | null;
  serviceWriterUserId?: string | null;
  assignedTechUserId?: string | null;
  priority?: string;
  title?: string;
  complaint?: string | null;
  internalNotes?: string | null;
  odometerIn?: number | null;
  odometerOut?: number | null;
  promisedAt?: Date | string | null;
};

type WorkOrderFormProps = {
  initial?: WorkOrderFormValue;
  customers: CustomerOption[];
  vehicles: VehicleOption[];
  users: UserOption[];
  bays?: BayOption[];
  canMutate: boolean;
};

export function WorkOrderForm({
  initial,
  customers,
  vehicles,
  users,
  bays,
  canMutate,
}: WorkOrderFormProps) {
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
      customerId: formData.get("customerId"),
      vehicleId: optionalString(formData.get("vehicleId")),
      opportunityId: optionalString(formData.get("opportunityId")),
      quoteId: optionalString(formData.get("quoteId")),
      bayId: optionalString(formData.get("bayId")),
      serviceWriterUserId: optionalString(formData.get("serviceWriterUserId")),
      assignedTechUserId: optionalString(formData.get("assignedTechUserId")),
      priority: formData.get("priority"),
      title: formData.get("title"),
      complaint: optionalString(formData.get("complaint")),
      internalNotes: optionalString(formData.get("internalNotes")),
      odometerIn: numericField(formData.get("odometerIn")),
      odometerOut: numericField(formData.get("odometerOut")),
      promisedAt: optionalString(formData.get("promisedAt")),
    };

    const response = await apiFetch(isEditing ? `/api/work-orders/${initial?.id}` : "/api/work-orders", {
      method: isEditing ? "PATCH" : "POST",
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Unable to save work order.");
      setIsSaving(false);
      return;
    }

    const data = (await response.json()) as { workOrder: { id: string } };

    if (isEditing) {
      router.refresh();
    } else {
      router.push(`/work-orders/${data.workOrder.id}`);
      router.refresh();
    }

    setIsSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <FormError message={error} />
      {!canMutate ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200">
          Your role cannot modify this work order.
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Title">
          <input
            name="title"
            defaultValue={initial?.title ?? ""}
            disabled={!canMutate}
            required
            className={inputClassName}
          />
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

        <Field label="Customer">
          <select
            name="customerId"
            defaultValue={initial?.customerId ?? ""}
            disabled={!canMutate}
            required
            className={inputClassName}
          >
            <option value="">Select customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.displayName}
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
                {vehicleLabel(vehicle)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Service Writer">
          <select
            name="serviceWriterUserId"
            defaultValue={initial?.serviceWriterUserId ?? ""}
            disabled={!canMutate}
            className={inputClassName}
          >
            <option value="">Use current user</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.email}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Assigned Tech">
          <select
            name="assignedTechUserId"
            defaultValue={initial?.assignedTechUserId ?? ""}
            disabled={!canMutate}
            className={inputClassName}
          >
            <option value="">Unassigned</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.email}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Promised Date">
          <input
            name="promisedAt"
            type="date"
            defaultValue={dateInput(initial?.promisedAt)}
            disabled={!canMutate}
            className={inputClassName}
          />
        </Field>

        <Field label="Odometer In">
          <input
            name="odometerIn"
            type="number"
            min="0"
            step="1"
            defaultValue={numberInput(initial?.odometerIn)}
            disabled={!canMutate}
            className={inputClassName}
          />
        </Field>

        <Field label="Odometer Out">
          <input
            name="odometerOut"
            type="number"
            min="0"
            step="1"
            defaultValue={numberInput(initial?.odometerOut)}
            disabled={!canMutate}
            className={inputClassName}
          />
        </Field>

        <Field label="Opportunity ID">
          <input
            name="opportunityId"
            defaultValue={initial?.opportunityId ?? ""}
            disabled={!canMutate}
            className={inputClassName}
          />
        </Field>

        <Field label="Quote ID">
          <input
            name="quoteId"
            defaultValue={initial?.quoteId ?? ""}
            disabled={!canMutate}
            className={inputClassName}
          />
        </Field>

        <Field label="Bay">
          <select
            name="bayId"
            defaultValue={initial?.bayId ?? ""}
            disabled={!canMutate}
            className={inputClassName}
          >
            <option value="">Unassigned</option>
            {bays?.map((bay) => (
              <option key={bay.id} value={bay.id}>
                {bay.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Complaint">
        <textarea
          name="complaint"
          defaultValue={initial?.complaint ?? ""}
          disabled={!canMutate}
          className={`${inputClassName} min-h-24`}
        />
      </Field>

      <Field label="Internal Notes">
        <textarea
          name="internalNotes"
          defaultValue={initial?.internalNotes ?? ""}
          disabled={!canMutate}
          className={`${inputClassName} min-h-24`}
        />
      </Field>

      {canMutate ? (
        <button type="submit" disabled={isSaving} className={primaryButtonClassName}>
          {isSaving ? "Saving..." : isEditing ? "Save work order" : "Create work order"}
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

function dateInput(value: Date | string | null | undefined) {
  if (!value) {
    return "";
  }

  return new Date(value).toISOString().slice(0, 10);
}

function numberInput(value: number | null | undefined) {
  return value == null ? "" : String(value);
}

function vehicleLabel(vehicle: VehicleOption) {
  return (
    [vehicle.unitNumber ? `Unit ${vehicle.unitNumber}` : null, vehicle.year, vehicle.make, vehicle.model]
      .filter(Boolean)
      .join(" ") || vehicle.id
  );
}
