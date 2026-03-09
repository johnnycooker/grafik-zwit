"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  ArrowLeft,
  Save,
  Search,
  RefreshCw,
  LogIn,
  LogOut,
  Pencil,
  Settings2,
} from "lucide-react";
import { msalInstance, graphScopes } from "@/lib/msal";
import type { AccountInfo, SilentRequest } from "@azure/msal-browser";
import type { ScheduleData } from "@/lib/parse-schedule";
import type { ScheduleUser } from "@/lib/schedule-users.shared";
import { resolveVisibleUsers } from "@/lib/schedule-visible-users";

const SHIFT_OPTIONS = [
  "",
  "I dyżur",
  "II dyżur",
  "IV dyżur",
  "wsp7",
  "wsp8",
  "wsp9",
  "urlop",
  "wolne",
];

const SHIFT_STYLES: Record<string, string> = {
  "I dyżur":
    "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30",
  wsp7: "bg-sky-500/15 text-sky-300 ring-1 ring-inset ring-sky-500/30",
  wsp8: "bg-violet-500/15 text-violet-300 ring-1 ring-inset ring-violet-500/30",
  wsp9: "bg-indigo-500/15 text-indigo-300 ring-1 ring-inset ring-indigo-500/30",
  "II dyżur":
    "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/30",
  "IV dyżur": "bg-rose-500/15 text-rose-300 ring-1 ring-inset ring-rose-500/30",
  urlop: "bg-green-500/15 text-green-300 ring-1 ring-inset ring-green-500/30",
  wolne: "bg-zinc-500/15 text-zinc-300 ring-1 ring-inset ring-zinc-500/30",
};

function getShiftClass(value: string) {
  return (
    SHIFT_STYLES[value] ??
    "bg-white/5 text-zinc-300 ring-1 ring-inset ring-white/10"
  );
}

function isWeekend(dateString: string) {
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return false;
  const day = parsed.getDay();
  return day === 0 || day === 6;
}

function getWeekdayLabel(dateString: string) {
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("pl-PL", { weekday: "short" });
}

function cloneScheduleData(data: ScheduleData): ScheduleData {
  return {
    employees: [...data.employees],
    rows: data.rows.map((row) => ({
      date: row.date,
      employees: { ...row.employees },
    })),
    meta: { ...data.meta },
  };
}

async function ensureMsalReady() {
  await msalInstance.initialize();
  const redirectResult = await msalInstance.handleRedirectPromise();

  if (redirectResult?.account) {
    msalInstance.setActiveAccount(redirectResult.account);
  }

  const active =
    msalInstance.getActiveAccount() ?? msalInstance.getAllAccounts()[0] ?? null;

  if (active) {
    msalInstance.setActiveAccount(active);
  }

  return {
    redirectResult,
    account: active,
  };
}

async function getAccessToken(): Promise<{
  accessToken: string;
  account: AccountInfo | null;
}> {
  const { account } = await ensureMsalReady();

  if (!account) {
    throw new Error("Nie jesteś zalogowany.");
  }

  const silentRequest: SilentRequest = {
    account,
    scopes: graphScopes,
  };

  const silent = await msalInstance.acquireTokenSilent(silentRequest);

  return {
    accessToken: silent.accessToken,
    account,
  };
}

export default function ScheduleEditor() {
  const [data, setData] = useState<ScheduleData | null>(null);
  const [users, setUsers] = useState<ScheduleUser[]>([]);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [lastSync, setLastSync] = useState("");
  const [search, setSearch] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [account, setAccount] = useState<AccountInfo | null>(null);

  useEffect(() => {
    async function bootstrap() {
      try {
        setLoading(true);
        setError("");

        const [{ account }, response, usersResponse] = await Promise.all([
          ensureMsalReady(),
          fetch("/api/schedule/current", {
            method: "GET",
            cache: "no-store",
          }),
          fetch("/api/users", {
            method: "GET",
            cache: "no-store",
          }),
        ]);

        setAccount(account);

        const result = await response.json();
        const usersResult = await usersResponse.json();

        if (!response.ok || !result.ok) {
          throw new Error(
            result.error || "Nie udało się pobrać danych z Firebase.",
          );
        }

        if (!usersResponse.ok || !usersResult.ok) {
          throw new Error(
            usersResult.error || "Nie udało się pobrać listy użytkowników.",
          );
        }

        if (result.data) {
          const cloned = cloneScheduleData(result.data);
          setData(cloned);
          setSavedSnapshot(JSON.stringify(cloned));
        }

        setUsers(usersResult.users ?? []);

        if (result.meta?.savedAt) {
          setLastSync(new Date(result.meta.savedAt).toLocaleString("pl-PL"));
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Błąd inicjalizacji edytora.",
        );
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, []);

  const isDirty = useMemo(() => {
    if (!data) return false;
    return JSON.stringify(data) !== savedSnapshot;
  }, [data, savedSnapshot]);

  const allowedUsers = useMemo(
    () => resolveVisibleUsers(data, users),
    [data, users],
  );

  const visibleUsers = useMemo(() => {
    const base = employeeFilter
      ? allowedUsers.filter((user) => user.id === employeeFilter)
      : allowedUsers;

    if (!search.trim()) return base;

    return base.filter((user) =>
      user.displayName.toLowerCase().includes(search.toLowerCase()),
    );
  }, [allowedUsers, employeeFilter, search]);

  async function handleLogin() {
    try {
      setError("");
      await ensureMsalReady();

      await msalInstance.loginRedirect({
        scopes: graphScopes,
        prompt: "select_account",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się zalogować.");
    }
  }

  async function handleLogout() {
    try {
      setError("");
      await ensureMsalReady();

      const active =
        msalInstance.getActiveAccount() ??
        msalInstance.getAllAccounts()[0] ??
        undefined;

      setAccount(null);

      await msalInstance.logoutRedirect({
        account: active,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się wylogować.");
    }
  }

  async function reloadFromFirebase() {
    try {
      setReloading(true);
      setError("");
      setSuccess("");

      const [response, usersResponse] = await Promise.all([
        fetch("/api/schedule/current", {
          method: "GET",
          cache: "no-store",
        }),
        fetch("/api/users", {
          method: "GET",
          cache: "no-store",
        }),
      ]);

      const result = await response.json();
      const usersResult = await usersResponse.json();

      if (!response.ok || !result.ok) {
        throw new Error(
          result.error || "Nie udało się pobrać danych z Firebase.",
        );
      }

      if (!usersResponse.ok || !usersResult.ok) {
        throw new Error(
          usersResult.error || "Nie udało się pobrać listy użytkowników.",
        );
      }

      if (result.data) {
        const cloned = cloneScheduleData(result.data);
        setData(cloned);
        setSavedSnapshot(JSON.stringify(cloned));
      } else {
        setData(null);
        setSavedSnapshot("");
      }

      setUsers(usersResult.users ?? []);

      if (result.meta?.savedAt) {
        setLastSync(new Date(result.meta.savedAt).toLocaleString("pl-PL"));
      } else {
        setLastSync("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nieznany błąd.");
    } finally {
      setReloading(false);
    }
  }

  function handleCellChange(date: string, excelName: string, value: string) {
    setSuccess("");

    setData((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        rows: prev.rows.map((row) =>
          row.date === date
            ? {
                ...row,
                employees: {
                  ...row.employees,
                  [excelName]: value,
                },
              }
            : row,
        ),
      };
    });
  }

  async function handleSave() {
    try {
      if (!data) {
        throw new Error("Brak danych do zapisania.");
      }

      setSaving(true);
      setError("");
      setSuccess("");

      const { accessToken, account } = await getAccessToken();
      setAccount(account);

      const response = await fetch("/api/schedule/save", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accessToken,
          data,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Nie udało się zapisać zmian.");
      }

      const cloned = cloneScheduleData(result.data);
      setData(cloned);
      setSavedSnapshot(JSON.stringify(cloned));

      if (result.firebase?.savedAt) {
        setLastSync(new Date(result.firebase.savedAt).toLocaleString("pl-PL"));
      }

      const changedCells = result.workbook?.changedCells ?? 0;
      const missingEmployees = Array.isArray(result.workbook?.missingEmployees)
        ? result.workbook.missingEmployees.length
        : 0;
      const missingDates = Array.isArray(result.workbook?.missingDates)
        ? result.workbook.missingDates.length
        : 0;

      setSuccess(
        `Zapisano zmiany do Excela. Zmienione komórki: ${changedCells}. Pominięte nazwiska: ${missingEmployees}. Pominięte daty: ${missingDates}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nieznany błąd.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <div className="mx-auto max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 overflow-hidden rounded-[30px] border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
          <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-300">
                Edycja grafiku i zapis do Excela
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
                  Edytor grafiku
                </h1>
              </div>

              <p className="mt-2 max-w-3xl text-sm text-zinc-400 sm:text-base">
                Tutaj edytujesz grafik zapisany w Firebase, a po kliknięciu
                „Zapisz do Excela” nadpisujesz plik XLSX w OneDrive.
              </p>

              <p className="mt-2 text-xs text-zinc-500">
                {account
                  ? `Zalogowano jako: ${account.username}`
                  : "Nie jesteś zalogowany"}
              </p>
            </div>

            <div className="flex flex-col items-start gap-3 lg:items-end">
              <div className="flex flex-wrap gap-3">
                {!account ? (
                  <button
                    onClick={handleLogin}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    <LogIn className="h-4 w-4" />
                    Zaloguj Microsoft
                  </button>
                ) : (
                  <button
                    onClick={handleLogout}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    <LogOut className="h-4 w-4" />
                    Wyloguj
                  </button>
                )}

                <Link
                  href="/users"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  <Settings2 className="h-4 w-4" />
                  Użytkownicy
                </Link>

                <button
                  onClick={reloadFromFirebase}
                  disabled={reloading || saving}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCw
                    className={clsx("h-4 w-4", reloading && "animate-spin")}
                  />
                  {reloading ? "Odświeżanie..." : "Przeładuj z Firebase"}
                </button>

                <button
                  onClick={handleSave}
                  disabled={!data || saving || !isDirty}
                  className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:scale-[1.01] hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save
                    className={clsx("h-4 w-4", saving && "animate-pulse")}
                  />
                  {saving ? "Zapisywanie..." : "Zapisz do Excela"}
                </button>
              </div>

              <div className="text-xs text-zinc-500">
                {lastSync
                  ? `Ostatni zapis danych: ${lastSync}`
                  : "Brak zapisu w Firebase"}
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <div className="mb-6 whitespace-pre-wrap rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mb-6 whitespace-pre-wrap rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {success}
          </div>
        ) : null}

        <div className="mb-6 grid gap-3 lg:grid-cols-[1fr_260px]">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
            <Search className="h-4 w-4 text-zinc-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Szukaj pracownika..."
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
            />
          </div>

          <select
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
          >
            <option value="">Wszyscy pracownicy</option>
            {allowedUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {SHIFT_OPTIONS.filter(Boolean).map((shift) => (
            <span
              key={shift}
              className={clsx(
                "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
                getShiftClass(shift),
              )}
            >
              {shift}
            </span>
          ))}
        </div>

        <div className="overflow-hidden rounded-[30px] border border-white/10 bg-white/5 shadow-[0_20px_90px_rgba(0,0,0,0.28)] backdrop-blur">
          <div className="border-b border-white/10 px-5 py-4">
            <div className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-zinc-300" />
              <h2 className="text-lg font-semibold">Edycja grafiku</h2>
            </div>
            <p className="mt-1 text-sm text-zinc-400">
              Zmieniaj wartości bezpośrednio w komórkach i zapisz całość do
              Excela.
            </p>
          </div>

          {loading ? (
            <div className="px-6 py-16 text-center text-zinc-500">
              Wczytywanie danych z Firebase...
            </div>
          ) : !data ? (
            <div className="px-6 py-16 text-center text-zinc-500">
              Brak danych do edycji. Najpierw wejdź na stronę główną i kliknij
              „Zaczytaj dane”.
            </div>
          ) : !visibleUsers.length ? (
            <div className="px-6 py-16 text-center text-zinc-500">
              Brak aktywnych użytkowników dopasowanych do Excela. Dodaj ich w
              panelu{" "}
              <span className="font-medium text-zinc-300">Użytkownicy</span>.
            </div>
          ) : (
            <div className="max-h-[75vh] overflow-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead className="sticky top-0 z-30">
                  <tr>
                    <th className="sticky left-0 z-40 border-b border-r border-white/10 bg-zinc-950/95 px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400 backdrop-blur">
                      Data
                    </th>

                    {visibleUsers.map((user) => (
                      <th
                        key={user.id}
                        className="border-b border-white/10 bg-zinc-950/95 px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400 backdrop-blur"
                      >
                        {user.displayName}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {data.rows.map((row) => {
                    const weekend = isWeekend(row.date);

                    return (
                      <tr
                        key={row.date}
                        className={clsx(
                          weekend
                            ? "bg-amber-500/[0.05]"
                            : "hover:bg-white/[0.03]",
                        )}
                      >
                        <td className="sticky left-0 z-20 border-b border-r border-white/10 bg-zinc-950 px-4 py-3 align-top">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-white">
                              {row.date}
                            </span>
                            <span className="mt-1 text-xs uppercase tracking-wide text-zinc-500">
                              {getWeekdayLabel(row.date)}
                            </span>
                          </div>
                        </td>

                        {visibleUsers.map((user) => {
                          const value = row.employees[user.excelName] ?? "";

                          return (
                            <td
                              key={`${row.date}-${user.id}`}
                              className="border-b border-white/10 px-3 py-3"
                            >
                              <select
                                value={value}
                                onChange={(e) =>
                                  handleCellChange(
                                    row.date,
                                    user.excelName,
                                    e.target.value,
                                  )
                                }
                                className={clsx(
                                  "w-full min-w-[120px] rounded-xl px-3 py-2 text-xs font-medium outline-none",
                                  "bg-zinc-950 text-white ring-1 ring-inset ring-white/10",
                                  value && getShiftClass(value),
                                )}
                              >
                                {SHIFT_OPTIONS.map((option) => (
                                  <option
                                    key={option || "__empty__"}
                                    value={option}
                                  >
                                    {option || "—"}
                                  </option>
                                ))}
                              </select>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-6 text-sm text-zinc-500">
          {isDirty ? "Masz niezapisane zmiany." : "Brak niezapisanych zmian."}
        </div>
      </div>
    </div>
  );
}
