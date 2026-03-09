"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  ArrowLeft,
  KeyRound,
  Plus,
  Shield,
  Trash2,
  UserCog,
  UserPlus,
} from "lucide-react";
import type { AppAccount, AppPermission, AppRole } from "@/types/auth";
import { APP_PERMISSIONS } from "@/types/auth";

type CreateForm = {
  username: string;
  password: string;
  role: AppRole;
  permissions: AppPermission[];
};

const DEFAULT_CREATE_FORM: CreateForm = {
  username: "",
  password: "",
  role: "employee",
  permissions: ["schedule.read"],
};

function getDefaultPermissionsForRole(role: AppRole): AppPermission[] {
  switch (role) {
    case "employee":
      return ["schedule.read"];
    case "coordinator":
      return ["schedule.read"];
    case "admin":
      return [...APP_PERMISSIONS];
    default:
      return ["schedule.read"];
  }
}

function normalizePermissionsForRole(
  role: AppRole,
  permissions: AppPermission[],
): AppPermission[] {
  const unique = [...new Set(permissions)];

  if (role === "employee") {
    return ["schedule.read"];
  }

  if (role === "coordinator" && !unique.includes("schedule.read")) {
    return ["schedule.read", ...unique];
  }

  return unique;
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        "relative inline-flex h-7 w-12 items-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-50",
        checked
          ? "border-emerald-400/40 bg-emerald-500/20"
          : "border-white/10 bg-white/5",
      )}
    >
      <span
        className={clsx(
          "ml-1 inline-block h-5 w-5 rounded-full transition-transform",
          checked
            ? "translate-x-5 bg-emerald-300"
            : "translate-x-0 bg-zinc-400",
        )}
      />
    </button>
  );
}

function togglePermission(
  permissions: AppPermission[],
  permission: AppPermission,
) {
  if (permissions.includes(permission)) {
    return permissions.filter((item) => item !== permission);
  }

  return [...permissions, permission];
}

export default function AccountsManager() {
  const [accounts, setAccounts] = useState<AppAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordSavingId, setPasswordSavingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [createForm, setCreateForm] = useState<CreateForm>(DEFAULT_CREATE_FORM);
  const [passwords, setPasswords] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadAccounts() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch("/api/accounts", {
          method: "GET",
          cache: "no-store",
        });

        const result = await response.json();

        if (!response.ok || !result.ok) {
          throw new Error(result.error || "Nie udało się pobrać kont.");
        }

        setAccounts(result.accounts ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Nieznany błąd.");
      } finally {
        setLoading(false);
      }
    }

    loadAccounts();
  }, []);

  const coordinatorsCount = useMemo(
    () => accounts.filter((account) => account.role === "coordinator").length,
    [accounts],
  );

  const employeesCount = useMemo(
    () => accounts.filter((account) => account.role === "employee").length,
    [accounts],
  );

  async function handleCreate() {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const payload = {
        ...createForm,
        permissions: normalizePermissionsForRole(
          createForm.role,
          createForm.permissions,
        ),
      };

      const response = await fetch("/api/accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Nie udało się utworzyć konta.");
      }

      setAccounts(result.accounts ?? []);
      setCreateForm(DEFAULT_CREATE_FORM);
      setSuccess("Utworzono konto.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nieznany błąd.");
    } finally {
      setSaving(false);
    }
  }

  async function patchAccount(
    id: string,
    payload: Partial<
      Pick<AppAccount, "username" | "role" | "isActive" | "permissions">
    >,
  ) {
    const response = await fetch(`/api/accounts/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Nie udało się zaktualizować konta.");
    }

    setAccounts(result.accounts ?? []);
  }

  async function handleDelete(account: AppAccount) {
    const confirmed = window.confirm(
      `Na pewno usunąć konto ${account.username}?`,
    );

    if (!confirmed) return;

    try {
      setError("");
      setSuccess("");

      const response = await fetch(`/api/accounts/${account.id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Nie udało się usunąć konta.");
      }

      setAccounts(result.accounts ?? []);
      setSuccess("Usunięto konto.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nieznany błąd.");
    }
  }

  async function handlePasswordChange(account: AppAccount) {
    const password = passwords[account.id] ?? "";

    try {
      setPasswordSavingId(account.id);
      setError("");
      setSuccess("");

      const response = await fetch(`/api/accounts/${account.id}/password`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Nie udało się zmienić hasła.");
      }

      setAccounts(result.accounts ?? []);
      setPasswords((prev) => ({
        ...prev,
        [account.id]: "",
      }));
      setSuccess(`Zmieniono hasło dla ${account.username}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nieznany błąd.");
    } finally {
      setPasswordSavingId("");
    }
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <div className="mx-auto max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 overflow-hidden rounded-[30px] border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
          <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-300">
                Firestore accounts
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Wróć
                </Link>

                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  Konta
                </h1>
              </div>

              <p className="mt-2 max-w-3xl text-sm text-zinc-400 sm:text-base">
                Zarządzanie kontami admina, pracowników i koordynatorów.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <MiniStat
                label="Wszystkie konta"
                value={String(accounts.length)}
              />
              <MiniStat label="Pracownicy" value={String(employeesCount)} />
              <MiniStat
                label="Koordynatorzy"
                value={String(coordinatorsCount)}
              />
              <MiniStat
                label="Systemowe"
                value={String(accounts.filter((item) => item.isSystem).length)}
              />
            </div>
          </div>
        </div>

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mb-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {success}
          </div>
        ) : null}

        <div className="mb-6 grid gap-6 xl:grid-cols-[420px_1fr]">
          <div className="rounded-[30px] border border-white/10 bg-white/[0.04] p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-2 text-zinc-300">
                <UserPlus className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Dodaj konto</h2>
                <p className="text-sm text-zinc-400">
                  Tworzysz konto pracownika albo koordynatora.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <Field label="Login">
                <input
                  value={createForm.username}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      username: e.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
                  placeholder="np. jan.kowalski"
                />
              </Field>

              <Field label="Hasło">
                <input
                  type="password"
                  value={createForm.password}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      password: e.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
                  placeholder="minimum 6 znaków"
                />
              </Field>

              <Field label="Rola">
                <select
                  value={createForm.role}
                  onChange={(e) => {
                    const role = e.target.value as AppRole;
                    setCreateForm((prev) => ({
                      ...prev,
                      role,
                      permissions: getDefaultPermissionsForRole(role),
                    }));
                  }}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
                >
                  <option value="employee">employee</option>
                  <option value="coordinator">coordinator</option>
                </select>
              </Field>

              <div>
                <div className="mb-2 text-sm font-medium text-zinc-300">
                  Uprawnienia
                </div>

                {createForm.role === "employee" ? (
                  <label className="flex cursor-not-allowed items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 opacity-70">
                    <input type="checkbox" checked disabled />
                    <span className="text-sm text-zinc-200">schedule.read</span>
                  </label>
                ) : (
                  <div className="space-y-2">
                    {APP_PERMISSIONS.map((permission) => (
                      <label
                        key={permission}
                        className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                      >
                        <input
                          type="checkbox"
                          checked={createForm.permissions.includes(permission)}
                          onChange={() =>
                            setCreateForm((prev) => ({
                              ...prev,
                              permissions: normalizePermissionsForRole(
                                prev.role,
                                togglePermission(prev.permissions, permission),
                              ),
                            }))
                          }
                        />
                        <span className="text-sm text-zinc-200">
                          {permission}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleCreate}
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                {saving ? "Tworzenie..." : "Utwórz konto"}
              </button>
            </div>
          </div>

          <div className="rounded-[30px] border border-white/10 bg-white/[0.04] p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-2 text-zinc-300">
                <UserCog className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Lista kont</h2>
                <p className="text-sm text-zinc-400">
                  Konto admina jest nieusuwalne i nie da się go dezaktywować.
                </p>
              </div>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-12 text-center text-zinc-500">
                Wczytywanie kont...
              </div>
            ) : (
              <div className="space-y-4">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4"
                  >
                    <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr_220px]">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-base font-semibold text-white">
                            {account.username}
                          </div>

                          <span
                            className={clsx(
                              "rounded-full px-3 py-1 text-xs font-medium",
                              account.role === "admin"
                                ? "bg-red-500/10 text-red-200"
                                : account.role === "employee"
                                  ? "bg-cyan-500/10 text-cyan-200"
                                  : "bg-violet-500/10 text-violet-200",
                            )}
                          >
                            {account.role}
                          </span>

                          {account.isSystem ? (
                            <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-200">
                              systemowe
                            </span>
                          ) : null}

                          <span
                            className={clsx(
                              "rounded-full px-3 py-1 text-xs font-medium",
                              account.isActive
                                ? "bg-emerald-500/10 text-emerald-200"
                                : "bg-zinc-500/10 text-zinc-300",
                            )}
                          >
                            {account.isActive ? "aktywne" : "nieaktywne"}
                          </span>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {account.permissions.map((permission) => (
                            <span
                              key={permission}
                              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300"
                            >
                              {permission}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Field label="Aktywne">
                          <Toggle
                            checked={account.isActive}
                            disabled={account.isSystem}
                            onChange={async (value) => {
                              try {
                                setError("");
                                setSuccess("");
                                await patchAccount(account.id, {
                                  isActive: value,
                                });
                                setSuccess("Zmieniono status konta.");
                              } catch (err) {
                                setError(
                                  err instanceof Error
                                    ? err.message
                                    : "Nieznany błąd.",
                                );
                              }
                            }}
                          />
                        </Field>

                        {!account.isSystem ? (
                          <Field label="Rola">
                            <select
                              value={account.role}
                              onChange={async (e) => {
                                const role = e.target.value as AppRole;
                                try {
                                  setError("");
                                  setSuccess("");
                                  await patchAccount(account.id, {
                                    role,
                                    permissions:
                                      getDefaultPermissionsForRole(role),
                                  });
                                  setSuccess("Zmieniono rolę konta.");
                                } catch (err) {
                                  setError(
                                    err instanceof Error
                                      ? err.message
                                      : "Nieznany błąd.",
                                  );
                                }
                              }}
                              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
                            >
                              <option value="employee">employee</option>
                              <option value="coordinator">coordinator</option>
                            </select>
                          </Field>
                        ) : null}

                        {!account.isSystem ? (
                          <Field label="Uprawnienia">
                            {account.role === "employee" ? (
                              <label className="flex cursor-not-allowed items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 opacity-70">
                                <input type="checkbox" checked disabled />
                                <span className="text-xs text-zinc-200">
                                  schedule.read
                                </span>
                              </label>
                            ) : (
                              <div className="space-y-2">
                                {APP_PERMISSIONS.map((permission) => (
                                  <label
                                    key={permission}
                                    className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={account.permissions.includes(
                                        permission,
                                      )}
                                      onChange={async () => {
                                        try {
                                          setError("");
                                          setSuccess("");
                                          await patchAccount(account.id, {
                                            permissions:
                                              normalizePermissionsForRole(
                                                account.role,
                                                togglePermission(
                                                  account.permissions,
                                                  permission,
                                                ),
                                              ),
                                          });
                                          setSuccess("Zmieniono uprawnienia.");
                                        } catch (err) {
                                          setError(
                                            err instanceof Error
                                              ? err.message
                                              : "Nieznany błąd.",
                                          );
                                        }
                                      }}
                                    />
                                    <span className="text-xs text-zinc-200">
                                      {permission}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </Field>
                        ) : null}
                      </div>

                      <div className="space-y-3">
                        <Field label="Nowe hasło">
                          <input
                            type="password"
                            value={passwords[account.id] ?? ""}
                            onChange={(e) =>
                              setPasswords((prev) => ({
                                ...prev,
                                [account.id]: e.target.value,
                              }))
                            }
                            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
                            placeholder="minimum 6 znaków"
                          />
                        </Field>

                        <button
                          type="button"
                          onClick={() => handlePasswordChange(account)}
                          disabled={passwordSavingId === account.id}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <KeyRound className="h-4 w-4" />
                          {passwordSavingId === account.id
                            ? "Zmiana..."
                            : "Zmień hasło"}
                        </button>

                        {!account.isSystem ? (
                          <button
                            type="button"
                            onClick={() => handleDelete(account)}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100 transition hover:bg-red-500/15"
                          >
                            <Trash2 className="h-4 w-4" />
                            Usuń konto
                          </button>
                        ) : (
                          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
                            Konto systemowe jest chronione.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4">
      <div className="mb-2 inline-flex rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-300">
        <Shield className="h-4 w-4" />
      </div>
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-zinc-400">{label}</div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-medium text-zinc-300">{label}</div>
      {children}
    </label>
  );
}
