"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import {
  FormError,
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  smallInputClassName,
} from "@/components/core/FormShell";

type Entry = {
  id: string;
  productId: string;
  unitPrice: string | number;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  product: {
    id: string;
    sku: string;
    name: string;
  };
};

type ProductOption = {
  id: string;
  sku: string;
  name: string;
  defaultUnitPrice: string | number;
};

type PricebookEntryListProps = {
  pricebookId: string;
  entries: Entry[];
  products: ProductOption[];
  canMutate: boolean;
};

export function PricebookEntryList({
  pricebookId,
  entries,
  products,
  canMutate,
}: PricebookEntryListProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendingProductId, setPendingProductId] = useState("");
  const [pendingPrice, setPendingPrice] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState("");

  const assignedProductIds = useMemo(
    () => new Set(entries.map((entry) => entry.productId)),
    [entries],
  );
  const availableProducts = useMemo(
    () => products.filter((product) => !assignedProductIds.has(product.id)),
    [products, assignedProductIds],
  );

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canMutate) {
      return;
    }

    setError(null);

    if (!pendingProductId) {
      setError("Pick a product to add.");
      return;
    }

    const price = Number(pendingPrice);

    if (!Number.isFinite(price) || price < 0) {
      setError("Enter a valid unit price.");
      return;
    }

    setIsSaving(true);

    const response = await apiFetch(`/api/pricebooks/${pricebookId}/entries`, {
      method: "POST",
      body: JSON.stringify({ productId: pendingProductId, unitPrice: price }),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Unable to add pricebook entry.");
      setIsSaving(false);
      return;
    }

    setPendingProductId("");
    setPendingPrice("");
    setIsSaving(false);
    router.refresh();
  }

  async function handleUpdate(entryId: string) {
    const price = Number(editingPrice);

    if (!Number.isFinite(price) || price < 0) {
      setError("Enter a valid unit price.");
      return;
    }

    setError(null);
    const response = await apiFetch(`/api/pricebook-entries/${entryId}`, {
      method: "PATCH",
      body: JSON.stringify({ unitPrice: price }),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Unable to update entry.");
      return;
    }

    setEditingId(null);
    setEditingPrice("");
    router.refresh();
  }

  async function handleRemove(entryId: string) {
    if (!canMutate) {
      return;
    }

    const response = await apiFetch(`/api/pricebook-entries/${entryId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Unable to remove entry.");
      return;
    }

    router.refresh();
  }

  return (
    <div className="space-y-4">
      <FormError message={error} />
      {canMutate ? (
        <form
          onSubmit={handleAdd}
          className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70 md:flex-row md:items-end"
        >
          <label className="flex-1">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Product
            </span>
            <select
              value={pendingProductId}
              onChange={(event) => setPendingProductId(event.target.value)}
              className={`${inputClassName} mt-2`}
            >
              <option value="">Select a product</option>
              {availableProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.sku} - {product.name}
                </option>
              ))}
            </select>
          </label>
          <label className="md:w-40">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Unit Price
            </span>
            <input
              type="number"
              step="0.0001"
              min="0"
              value={pendingPrice}
              onChange={(event) => setPendingPrice(event.target.value)}
              className={`${inputClassName} mt-2`}
            />
          </label>
          <button type="submit" disabled={isSaving} className={primaryButtonClassName}>
            {isSaving ? "Adding..." : "Add entry"}
          </button>
        </form>
      ) : null}

      {entries.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
          No entries yet. Products without an entry fall back to their default unit price.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-col gap-2 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-black text-slate-950 dark:text-white">
                  {entry.product.sku} - {entry.product.name}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {editingId === entry.id ? (
                  <>
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      value={editingPrice}
                      onChange={(event) => setEditingPrice(event.target.value)}
                      className={smallInputClassName}
                      style={{ width: "8rem" }}
                    />
                    <button
                      type="button"
                      onClick={() => handleUpdate(entry.id)}
                      className={primaryButtonClassName}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setEditingPrice("");
                      }}
                      className={secondaryButtonClassName}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-sm font-bold text-slate-950 dark:text-white">
                      ${formatPrice(entry.unitPrice)}
                    </span>
                    {canMutate ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(entry.id);
                            setEditingPrice(formatPrice(entry.unitPrice));
                          }}
                          className={secondaryButtonClassName}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemove(entry.id)}
                          className={secondaryButtonClassName}
                        >
                          Remove
                        </button>
                      </>
                    ) : null}
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatPrice(value: string | number) {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    return "0.0000";
  }

  return parsed.toFixed(4);
}
