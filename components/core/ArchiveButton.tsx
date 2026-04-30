"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { dangerButtonClassName } from "@/components/core/FormShell";

type ArchiveButtonProps = {
  endpoint: string;
  label: string;
  redirectTo?: string;
  canMutate: boolean;
};

export function ArchiveButton({ endpoint, label, redirectTo, canMutate }: ArchiveButtonProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);

  async function handleArchive() {
    if (!canMutate || !window.confirm(`Archive ${label}?`)) {
      return;
    }

    setError(null);
    setIsArchiving(true);

    const response = await apiFetch(endpoint, { method: "DELETE" });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? `Unable to archive ${label}.`);
      setIsArchiving(false);
      return;
    }

    if (redirectTo) {
      router.push(redirectTo);
    }

    router.refresh();
  }

  if (!canMutate) {
    return null;
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleArchive}
        disabled={isArchiving}
        className={dangerButtonClassName}
      >
        {isArchiving ? "Archiving..." : `Archive ${label}`}
      </button>
      {error ? <p className="text-sm font-semibold text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
