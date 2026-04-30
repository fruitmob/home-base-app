"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import {
  Field,
  FormError,
  inputClassName,
  primaryButtonClassName,
  smallInputClassName,
} from "@/components/core/FormShell";
import { formatCurrency } from "@/lib/core/money";

export type WorkOrderLine = {
  id: string;
  lineType: string;
  status: string;
  description: string;
  quantity: number | string;
  unitPrice: number | string;
  unitCost?: number | string | null;
  lineTotal: number | string;
  taxable: boolean;
  displayOrder: number;
  productId?: string | null;
  partId?: string | null;
};

type WorkOrderLineEditorProps = {
  workOrderId: string;
  initialLineItems: WorkOrderLine[];
  canMutate: boolean;
};

export function WorkOrderLineEditor({
  workOrderId,
  initialLineItems,
  canMutate,
}: WorkOrderLineEditorProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canMutate) {
      return;
    }

    setError(null);
    setIsSaving(true);

    const response = await apiFetch(`/api/work-orders/${workOrderId}/line-items`, {
      method: "POST",
      body: JSON.stringify(linePayload(new FormData(event.currentTarget))),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Unable to add line.");
      setIsSaving(false);
      return;
    }

    event.currentTarget.reset();
    router.refresh();
    setIsSaving(false);
  }

  async function handleUpdate(lineId: string, formData: FormData) {
    if (!canMutate) {
      return;
    }

    setError(null);
    setIsSaving(true);

    const response = await apiFetch(`/api/work-order-line-items/${lineId}`, {
      method: "PATCH",
      body: JSON.stringify(linePayload(formData)),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Unable to update line.");
      setIsSaving(false);
      return;
    }

    router.refresh();
    setIsSaving(false);
  }

  async function handleDelete(lineId: string) {
    if (!canMutate || !window.confirm("Archive this line item?")) {
      return;
    }

    setError(null);
    setIsSaving(true);

    const response = await apiFetch(`/api/work-order-line-items/${lineId}`, { method: "DELETE" });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Unable to archive line.");
      setIsSaving(false);
      return;
    }

    router.refresh();
    setIsSaving(false);
  }

  return (
    <div className="space-y-5">
      <FormError message={error} />

      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
          <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:bg-slate-950 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left">Line</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Qty</th>
              <th className="px-4 py-3 text-left">Price</th>
              <th className="px-4 py-3 text-left">Total</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
            {initialLineItems.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                  No line items yet.
                </td>
              </tr>
            ) : (
              initialLineItems.map((line) => (
                <tr key={line.id} className="align-top">
                  <td className="px-4 py-3">
                    <input
                      form={`line-${line.id}`}
                      name="description"
                      defaultValue={line.description}
                      disabled={!canMutate}
                      className={smallInputClassName}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <select
                      form={`line-${line.id}`}
                      name="lineType"
                      defaultValue={line.lineType}
                      disabled={!canMutate}
                      className={smallInputClassName}
                    >
                      {lineTypes.map((lineType) => (
                        <option key={lineType} value={lineType}>
                          {lineType}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      form={`line-${line.id}`}
                      name="quantity"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={String(line.quantity)}
                      disabled={!canMutate}
                      className={`${smallInputClassName} w-24`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      form={`line-${line.id}`}
                      name="unitPrice"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={String(line.unitPrice)}
                      disabled={!canMutate}
                      className={`${smallInputClassName} w-28`}
                    />
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-950 dark:text-white">
                    {formatCurrency(line.lineTotal)}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      form={`line-${line.id}`}
                      name="status"
                      defaultValue={line.status}
                      disabled={!canMutate}
                      className={smallInputClassName}
                    >
                      {lineStatuses.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <form
                      id={`line-${line.id}`}
                      onSubmit={(event) => {
                        event.preventDefault();
                        void handleUpdate(line.id, new FormData(event.currentTarget));
                      }}
                      className="inline"
                    >
                      <input type="hidden" name="productId" defaultValue={line.productId ?? ""} />
                      <input type="hidden" name="partId" defaultValue={line.partId ?? ""} />
                      <input type="hidden" name="displayOrder" defaultValue={line.displayOrder} />
                      <button
                        type="submit"
                        disabled={!canMutate || isSaving}
                        className="rounded-full border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        Save
                      </button>
                    </form>
                    <button
                      type="button"
                      onClick={() => handleDelete(line.id)}
                      disabled={!canMutate || isSaving}
                      className="ml-2 rounded-full border border-red-200 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900/70 dark:text-red-300 dark:hover:bg-red-950/40"
                    >
                      Archive
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {canMutate ? (
        <form onSubmit={handleCreate} className="grid gap-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-800 md:grid-cols-[1fr_150px_120px_120px_auto]">
          <Field label="Description">
            <input name="description" required className={inputClassName} />
          </Field>
          <Field label="Type">
            <select name="lineType" defaultValue="LABOR" className={inputClassName}>
              {lineTypes.map((lineType) => (
                <option key={lineType} value={lineType}>
                  {lineType}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Quantity">
            <input name="quantity" type="number" min="0" step="0.01" defaultValue="1" className={inputClassName} />
          </Field>
          <Field label="Unit Price">
            <input name="unitPrice" type="number" min="0" step="0.01" defaultValue="0" className={inputClassName} />
          </Field>
          <div className="flex items-end">
            <button type="submit" disabled={isSaving} className={primaryButtonClassName}>
              Add line
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

const lineTypes = ["LABOR", "PART", "SUBLET", "FEE", "NOTE"] as const;
const lineStatuses = ["OPEN", "APPROVED", "IN_PROGRESS", "COMPLETE", "CANCELED"] as const;

function linePayload(formData: FormData) {
  return {
    productId: optionalString(formData.get("productId")),
    partId: optionalString(formData.get("partId")),
    lineType: formData.get("lineType"),
    status: formData.get("status") || "OPEN",
    description: formData.get("description"),
    quantity: numericField(formData.get("quantity")),
    unitPrice: numericField(formData.get("unitPrice")),
    unitCost: numericField(formData.get("unitCost")),
    taxable: formData.get("taxable") !== "false",
    displayOrder: numericField(formData.get("displayOrder")) ?? 0,
  };
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
