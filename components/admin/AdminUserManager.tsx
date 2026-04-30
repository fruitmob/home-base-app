"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import {
  dangerButtonClassName,
  Field,
  FormError,
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  smallInputClassName,
} from "@/components/core/FormShell";

type AdminUserRow = {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  disabledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type AdminUserManagerProps = {
  currentUserId: string;
  roles: string[];
  users: AdminUserRow[];
};

export function AdminUserManager({ currentUserId, roles, users }: AdminUserManagerProps) {
  const router = useRouter();
  const [createError, setCreateError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [draftRoles, setDraftRoles] = useState<Record<string, string>>(() =>
    Object.fromEntries(users.map((user) => [user.id, user.role])),
  );
  const defaultCreateRole = roles.includes("VIEWER") ? "VIEWER" : roles[0] ?? "";
  const [createRole, setCreateRole] = useState(defaultCreateRole);

  useEffect(() => {
    setDraftRoles(Object.fromEntries(users.map((user) => [user.id, user.role])));
    setCreateRole(defaultCreateRole);
  }, [defaultCreateRole, users]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError(null);
    setIsCreating(true);

    const formData = new FormData(event.currentTarget);
    const payload = {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      role: String(formData.get("role") ?? ""),
    };

    const response = await apiFetch("/api/admin/users", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      setCreateError(await readResponseError(response, "Unable to create user."));
      setIsCreating(false);
      return;
    }

    event.currentTarget.reset();
    setCreateRole(defaultCreateRole);
    setIsCreating(false);
    router.refresh();
  }

  async function handleRoleSave(userId: string) {
    const nextRole = draftRoles[userId];

    if (!nextRole) {
      return;
    }

    setRowError(null);
    setSavingUserId(userId);

    const response = await apiFetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ role: nextRole }),
    });

    if (!response.ok) {
      setRowError(await readResponseError(response, "Unable to update role."));
      setSavingUserId(null);
      return;
    }

    setSavingUserId(null);
    router.refresh();
  }

  async function handleActiveToggle(user: AdminUserRow) {
    setRowError(null);
    setSavingUserId(user.id);

    const response = await apiFetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: !user.isActive }),
    });

    if (!response.ok) {
      setRowError(await readResponseError(response, "Unable to update account status."));
      setSavingUserId(null);
      return;
    }

    setSavingUserId(null);
    router.refresh();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
          Create User
        </h3>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          New users start active immediately. Owner accounts stay protected behind extra rules.
        </p>
        <form onSubmit={handleCreate} className="mt-6 space-y-4">
          <FormError message={createError} />
          <Field label="Email">
            <input
              name="email"
              type="email"
              required
              autoComplete="off"
              className={inputClassName}
              placeholder="service.writer@example.com"
            />
          </Field>
          <Field label="Temporary Password">
            <input
              name="password"
              type="password"
              required
              minLength={10}
              autoComplete="new-password"
              className={inputClassName}
              placeholder="At least 10 characters"
            />
          </Field>
          <Field label="Role">
            <select
              name="role"
              value={createRole}
              onChange={(event) => setCreateRole(event.target.value)}
              className={inputClassName}
            >
              {roles.map((role) => (
                <option key={role} value={role}>
                  {formatRole(role)}
                </option>
              ))}
            </select>
          </Field>
          <button type="submit" disabled={isCreating} className={primaryButtonClassName}>
            {isCreating ? "Creating..." : "Create user"}
          </button>
        </form>
      </aside>

      <div className="space-y-4">
        <FormError message={rowError} />
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {users.length === 0 ? (
            <p className="p-8 text-sm text-slate-500 dark:text-slate-400">No users match those filters.</p>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-950">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                    User
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                    Role
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                    Status
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                    Updated
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {users.map((user) => {
                  const isCurrentUser = user.id === currentUserId;
                  const isSaving = savingUserId === user.id;
                  const selectedRole = draftRoles[user.id] ?? user.role;
                  const roleChanged = selectedRole !== user.role;

                  return (
                    <tr key={user.id} className="align-top hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-950 dark:text-white">{user.email}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Created {formatTimestamp(user.createdAt)}
                          {isCurrentUser ? " | Current session" : ""}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <select
                          value={selectedRole}
                          onChange={(event) =>
                            setDraftRoles((current) => ({
                              ...current,
                              [user.id]: event.target.value,
                            }))
                          }
                          className={smallInputClassName}
                          disabled={isSaving}
                        >
                          {roles.map((role) => (
                            <option key={role} value={role}>
                              {formatRole(role)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-5 py-4">
                        <p
                          className={`text-xs font-bold uppercase tracking-[0.18em] ${
                            user.isActive
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-amber-700 dark:text-amber-300"
                          }`}
                        >
                          {user.isActive ? "Active" : "Disabled"}
                        </p>
                        {!user.isActive && user.disabledAt ? (
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {formatTimestamp(user.disabledAt)}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-500 dark:text-slate-400">
                        {formatTimestamp(user.updatedAt)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleRoleSave(user.id)}
                            disabled={isSaving || !roleChanged}
                            className={secondaryButtonClassName}
                          >
                            {isSaving && roleChanged ? "Saving..." : "Save role"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleActiveToggle(user)}
                            disabled={isSaving || isCurrentUser}
                            className={user.isActive ? dangerButtonClassName : secondaryButtonClassName}
                          >
                            {isSaving && !roleChanged
                              ? "Saving..."
                              : user.isActive
                                ? "Disable"
                                : "Restore"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

async function readResponseError(response: Response, fallback: string) {
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  return data.error ?? fallback;
}

function formatRole(value: string) {
  return value.toLowerCase().split("_").map(capitalize).join(" ");
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
