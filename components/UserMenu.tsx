"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { CurrentUser } from "@/lib/auth";

type UserMenuProps = {
  user: CurrentUser;
};

export function UserMenu({ user }: UserMenuProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setError(null);
    setIsLoggingOut(true);

    const response = await apiFetch("/api/auth/logout", { method: "POST" });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Unable to log out.");
      setIsLoggingOut(false);
      return;
    }

    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <p className="text-sm font-semibold text-slate-950 dark:text-white">{user.email}</p>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
          {user.role.replaceAll("_", " ")}
        </p>
        {error ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
      </div>
      <button
        type="button"
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
      >
        {isLoggingOut ? "Logging out..." : "Log out"}
      </button>
    </div>
  );
}
