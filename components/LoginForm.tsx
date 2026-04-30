"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { CurrentUser } from "@/lib/auth";

type AuthResponse = {
  user?: CurrentUser;
  error?: string;
};

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    let isMounted = true;

    fetch("/api/auth/me", { credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: AuthResponse | null) => {
        if (isMounted && data?.user) {
          setUser(data.user);
        }
      })
      .catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const response = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    const data = (await response.json().catch(() => ({}))) as AuthResponse;

    setIsSubmitting(false);

    if (!response.ok || !data.user) {
      setError(data.error ?? "Unable to sign in.");
      return;
    }

    setUser(data.user);
    setPassword("");

    const next = getSafeNextPath();

    if (next) {
      router.push(next);
      router.refresh();
    }
  }

  async function handleLogout() {
    setError(null);
    const response = await apiFetch("/api/auth/logout", { method: "POST" });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as AuthResponse;
      setError(data.error ?? "Unable to sign out.");
      return;
    }

    setUser(null);
    router.refresh();
  }

  if (user) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          <p className="text-sm font-semibold uppercase tracking-[0.2em]">
            Session active
          </p>
          <p className="mt-2 text-lg font-semibold">{user.email}</p>
          <p className="mt-1 text-sm opacity-80">{user.role}</p>
        </div>
        {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
        <button
          type="button"
          onClick={handleLogout}
          className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
        >
          Log out
        </button>
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <label className="block">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Email
        </span>
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-slate-950 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:focus:border-slate-300 dark:focus:ring-slate-800"
          required
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Password
        </span>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-slate-950 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:focus:border-slate-300 dark:focus:ring-slate-800"
          required
        />
      </label>
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
      >
        {isSubmitting ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}

function getSafeNextPath() {
  const params = new URLSearchParams(window.location.search);
  const next = params.get("next");

  if (!next || !next.startsWith("/") || next.startsWith("//") || next === "/login") {
    return null;
  }

  return next;
}
