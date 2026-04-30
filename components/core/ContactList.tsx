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

type Contact = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  isPrimary: boolean;
  notes: string | null;
};

type ContactListProps = {
  ownerType: "customer" | "vendor";
  ownerId: string;
  contacts: Contact[];
  canMutate: boolean;
};

export function ContactList({ ownerType, ownerId, contacts, canMutate }: ContactListProps) {
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

    const response = await apiFetch(`/${apiBase(ownerType)}/${ownerId}/contacts`, {
      method: "POST",
      body: JSON.stringify(contactPayload(new FormData(event.currentTarget))),
    });

    if (!response.ok) {
      await showError(response, setError, "Unable to create contact.");
      setIsSaving(false);
      return;
    }

    event.currentTarget.reset();
    setIsSaving(false);
    router.refresh();
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>, contactId: string) {
    event.preventDefault();

    if (!canMutate) {
      return;
    }

    setError(null);
    setIsSaving(true);

    const response = await apiFetch(`/api/contacts/${contactId}`, {
      method: "PATCH",
      body: JSON.stringify(contactPayload(new FormData(event.currentTarget))),
    });

    if (!response.ok) {
      await showError(response, setError, "Unable to update contact.");
      setIsSaving(false);
      return;
    }

    setEditingId(null);
    setIsSaving(false);
    router.refresh();
  }

  async function handleDelete(contactId: string) {
    if (!canMutate || !window.confirm("Archive this contact?")) {
      return;
    }

    setError(null);
    setIsSaving(true);

    const response = await apiFetch(`/api/contacts/${contactId}`, { method: "DELETE" });

    if (!response.ok) {
      await showError(response, setError, "Unable to archive contact.");
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
          Contacts
        </h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          People attached to this {ownerType}.
        </p>
      </div>
      <FormError message={error} />
      <div className="space-y-3">
        {contacts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No contacts yet.
          </p>
        ) : (
          contacts.map((contact) => (
            <article
              key={contact.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              {editingId === contact.id ? (
                <form onSubmit={(event) => handleUpdate(event, contact.id)} className="space-y-3">
                  <ContactFields contact={contact} />
                  <div className="flex flex-wrap gap-2">
                    <button type="submit" disabled={isSaving} className={primaryButtonClassName}>
                      Save contact
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
                      <p className="font-bold text-slate-950 dark:text-white">{contact.displayName}</p>
                      {contact.isPrimary ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          Primary
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {[contact.title, contact.email, contact.mobile ?? contact.phone]
                        .filter(Boolean)
                        .join(" | ") || "No contact details"}
                    </p>
                  </div>
                  {canMutate ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(contact.id)}
                        className={secondaryButtonClassName}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(contact.id)}
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
            Add Contact
          </p>
          <ContactFields />
          <button type="submit" disabled={isSaving} className={`${primaryButtonClassName} mt-3`}>
            Add contact
          </button>
        </form>
      ) : null}
    </section>
  );
}

function ContactFields({ contact }: { contact?: Contact }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <input name="firstName" defaultValue={contact?.firstName ?? ""} placeholder="First name" className={smallInputClassName} />
      <input name="lastName" defaultValue={contact?.lastName ?? ""} placeholder="Last name" className={smallInputClassName} />
      <input name="displayName" defaultValue={contact?.displayName ?? ""} placeholder="Display name" className={smallInputClassName} />
      <input name="title" defaultValue={contact?.title ?? ""} placeholder="Title" className={smallInputClassName} />
      <input name="email" type="email" defaultValue={contact?.email ?? ""} placeholder="Email" className={smallInputClassName} />
      <input name="phone" defaultValue={contact?.phone ?? ""} placeholder="Phone" className={smallInputClassName} />
      <input name="mobile" defaultValue={contact?.mobile ?? ""} placeholder="Mobile" className={smallInputClassName} />
      <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
        <input name="isPrimary" type="checkbox" defaultChecked={contact?.isPrimary ?? false} />
        Primary
      </label>
    </div>
  );
}

function contactPayload(formData: FormData) {
  return {
    firstName: optionalString(formData.get("firstName")),
    lastName: optionalString(formData.get("lastName")),
    displayName: optionalString(formData.get("displayName")),
    title: optionalString(formData.get("title")),
    email: optionalString(formData.get("email")),
    phone: optionalString(formData.get("phone")),
    mobile: optionalString(formData.get("mobile")),
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
