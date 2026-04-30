"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import {
  dangerButtonClassName,
  FormError,
  primaryButtonClassName,
  secondaryButtonClassName,
  smallInputClassName,
} from "@/components/core/FormShell";

type Address = {
  id: string;
  type: string;
  label: string | null;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postalCode: string | null;
  country: string;
  isPrimary: boolean;
};

type AddressListProps = {
  ownerType: "customer" | "vendor";
  ownerId: string;
  addresses: Address[];
  canMutate: boolean;
};

export function AddressList({ ownerType, ownerId, addresses, canMutate }: AddressListProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canMutate) {
      return;
    }

    setError(null);
    setIsSaving(true);

    const response = await apiFetch(`/${apiBase(ownerType)}/${ownerId}/addresses`, {
      method: "POST",
      body: JSON.stringify(addressPayload(new FormData(event.currentTarget))),
    });

    if (!response.ok) {
      await showError(response, setError, "Unable to create address.");
      setIsSaving(false);
      return;
    }

    event.currentTarget.reset();
    setIsSaving(false);
    router.refresh();
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>, addressId: string) {
    event.preventDefault();

    if (!canMutate) {
      return;
    }

    setError(null);
    setIsSaving(true);

    const response = await apiFetch(`/api/addresses/${addressId}`, {
      method: "PATCH",
      body: JSON.stringify(addressPayload(new FormData(event.currentTarget))),
    });

    if (!response.ok) {
      await showError(response, setError, "Unable to update address.");
      setIsSaving(false);
      return;
    }

    setEditingId(null);
    setIsSaving(false);
    router.refresh();
  }

  async function handleDelete(addressId: string) {
    if (!canMutate || !window.confirm("Archive this address?")) {
      return;
    }

    setError(null);
    setIsSaving(true);

    const response = await apiFetch(`/api/addresses/${addressId}`, { method: "DELETE" });

    if (!response.ok) {
      await showError(response, setError, "Unable to archive address.");
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    router.refresh();
  }

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
          Addresses
        </h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Billing, service, shipping, and mailing locations.
        </p>
      </div>
      <FormError message={error} />
      <div className="space-y-3">
        {addresses.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No addresses yet.
          </p>
        ) : (
          addresses.map((address) => (
            <article
              key={address.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              {editingId === address.id ? (
                <form onSubmit={(event) => handleUpdate(event, address.id)} className="space-y-3">
                  <AddressFields address={address} />
                  <div className="flex flex-wrap gap-2">
                    <button type="submit" disabled={isSaving} className={primaryButtonClassName}>
                      Save address
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className={secondaryButtonClassName}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-slate-950 dark:text-white">
                        {address.label || address.type.replaceAll("_", " ")}
                      </p>
                      {address.isPrimary ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          Primary
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {[address.line1, address.line2, address.city, address.state, address.postalCode, address.country]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  </div>
                  {canMutate ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(address.id)}
                        className={secondaryButtonClassName}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(address.id)}
                        disabled={isSaving}
                        className={dangerButtonClassName}
                      >
                        Archive
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </article>
          ))
        )}
      </div>
      {canMutate ? (
        <form
          onSubmit={handleCreate}
          className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"
        >
          <p className="mb-3 text-sm font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Add Address
          </p>
          <AddressFields />
          <button type="submit" disabled={isSaving} className={`${primaryButtonClassName} mt-3`}>
            Add address
          </button>
        </form>
      ) : null}
    </section>
  );
}

function AddressFields({ address }: { address?: Address }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <select name="type" defaultValue={address?.type ?? "OTHER"} className={smallInputClassName}>
        <option value="BILLING">Billing</option>
        <option value="SERVICE">Service</option>
        <option value="SHIPPING">Shipping</option>
        <option value="MAILING">Mailing</option>
        <option value="OTHER">Other</option>
      </select>
      <input name="label" defaultValue={address?.label ?? ""} placeholder="Label" className={smallInputClassName} />
      <input name="line1" defaultValue={address?.line1 ?? ""} placeholder="Line 1" className={smallInputClassName} required />
      <input name="line2" defaultValue={address?.line2 ?? ""} placeholder="Line 2" className={smallInputClassName} />
      <input name="city" defaultValue={address?.city ?? ""} placeholder="City" className={smallInputClassName} required />
      <input name="state" defaultValue={address?.state ?? ""} placeholder="State" className={smallInputClassName} />
      <input name="postalCode" defaultValue={address?.postalCode ?? ""} placeholder="Postal code" className={smallInputClassName} />
      <input name="country" defaultValue={address?.country ?? "US"} placeholder="Country" className={smallInputClassName} />
      <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
        <input name="isPrimary" type="checkbox" defaultChecked={address?.isPrimary ?? false} />
        Primary for this type
      </label>
    </div>
  );
}

function addressPayload(formData: FormData) {
  return {
    type: String(formData.get("type") || "OTHER"),
    label: optionalString(formData.get("label")),
    line1: optionalString(formData.get("line1")),
    line2: optionalString(formData.get("line2")),
    city: optionalString(formData.get("city")),
    state: optionalString(formData.get("state")),
    postalCode: optionalString(formData.get("postalCode")),
    country: optionalString(formData.get("country")) ?? "US",
    isPrimary: formData.get("isPrimary") === "on",
  };
}

function apiBase(ownerType: "customer" | "vendor") {
  return ownerType === "customer" ? "api/customers" : "api/vendors";
}

function optionalString(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";

  return text.length > 0 ? text : null;
}

async function showError(
  response: Response,
  setError: (message: string) => void,
  fallback: string,
) {
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  setError(data.error ?? fallback);
}
