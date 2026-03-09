"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  CalendarDays,
  Users,
  RefreshCw,
  Search,
  Clock3,
  Moon,
  Sun,
  Plane,
  LogIn,
  LogOut,
  Pencil,
  Settings2,
  ShieldX,
  Shield,
  FileText,
} from "lucide-react";
import { msalInstance, graphScopes } from "@/lib/msal";
import type { AccountInfo, SilentRequest } from "@azure/msal-browser";
import type { ScheduleData } from "@/lib/parse-schedule";
import type { ScheduleUser } from "@/lib/schedule-users.shared";
import { resolveVisibleUsers } from "@/lib/schedule-visible-users";
import { useSession, signOut } from "next-auth/react";
import type { AppPermission } from "@/types/auth";

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

function getShiftCounts(
  data: ScheduleData | null,
  visibleUsers: ScheduleUser[],
) {
  const counts: Record<string, number> = {};
  if (!data) return counts;

  for (const row of data.rows) {
    for (const user of visibleUsers) {
      const shift = row.employees[user.excelName];
      if (!shift) continue;
      counts[shift] = (counts[shift] || 0) + 1;
    }
  }

  return counts;
}

function hasAppPermission(
  permissions: AppPermission[] | undefined,
  permission: AppPermission,
) {
  if (!permissions) return false;
  return permissions.includes(permission);
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
    throw new Error("Nie jesteś zalogowany do Microsoft.");
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

export default function ScheduleApp() {
  const { data: session, status } = useSession();

  const [data, setData] = useState<ScheduleData | null>(null);
  const [users, setUsers] = useState<ScheduleUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [loggingOutApp, setLoggingOutApp] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [lastSync, setLastSync] = useState("");
  const [account, setAccount] = useState<AccountInfo | null>(null);

  const sessionPermissions = session?.user?.permissions;

  const canLoadExcel = hasAppPermission(
    sessionPermissions,
    "schedule.load_excel",
  );
  const canEditSchedule = hasAppPermission(sessionPermissions, "schedule.edit");
  const canManageEmployees = hasAppPermission(
    sessionPermissions,
    "employees.manage",
  );
  const canManageAccounts = hasAppPermission(
    sessionPermissions,
    "accounts.manage",
  );
  const canReadLogs = hasAppPermission(sessionPermissions, "logs.read");

  useEffect(() => {
    async function bootstrap() {
      try {
        setError("");

        const promises: Promise<Response | { account: AccountInfo | null }>[] =
          [
            fetch("/api/schedule/current", {
              method: "GET",
              cache: "no-store",
            }),
            fetch("/api/users", {
              method: "GET",
              cache: "no-store",
            }),
          ];

        if (canLoadExcel) {
          promises.unshift(ensureMsalReady());
        }

        const results = await Promise.all(promises);

        let currentResponse: Response;
        let usersResponse: Response;

        if (canLoadExcel) {
          const msalResult = results[0] as { account: AccountInfo | null };
          currentResponse = results[1] as Response;
          usersResponse = results[2] as Response;
          setAccount(msalResult.account);
        } else {
          currentResponse = results[0] as Response;
          usersResponse = results[1] as Response;
          setAccount(null);
        }

        const currentResult = await currentResponse.json();
        const usersResult = await usersResponse.json();

        if (!currentResponse.ok || !currentResult.ok) {
          throw new Error(
            currentResult.error || "Nie udało się pobrać danych z Firebase.",
          );
        }

        if (!usersResponse.ok || !usersResult.ok) {
          throw new Error(
            usersResult.error || "Nie udało się pobrać listy użytkowników.",
          );
        }

        if (currentResult.data) {
          setData(currentResult.data);
        } else {
          setData(null);
        }

        setUsers(usersResult.users ?? []);

        if (currentResult.meta?.savedAt) {
          setLastSync(
            new Date(currentResult.meta.savedAt).toLocaleString("pl-PL"),
          );
        } else {
          setLastSync("");
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Błąd inicjalizacji aplikacji.",
        );
      } finally {
        setInitialLoading(false);
      }
    }

    if (status !== "loading") {
      bootstrap();
    }
  }, [canLoadExcel, status]);

  const allowedUsers = useMemo(
    () => resolveVisibleUsers(data, users),
    [data, users],
  );

  const shiftCounts = useMemo(
    () => getShiftCounts(data, allowedUsers),
    [data, allowedUsers],
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
      setError(
        err instanceof Error
          ? err.message
          : "Nie udało się zalogować do Microsoft.",
      );
    }
  }

  async function handleMicrosoftLogout() {
    try {
      setError("");
      await ensureMsalReady();

      const active =
        msalInstance.getActiveAccount() ??
        msalInstance.getAllAccounts()[0] ??
        undefined;

      setData(null);
      setAccount(null);
      setLastSync("");

      await msalInstance.logoutRedirect({
        account: active,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Nie udało się wylogować z Microsoft.",
      );
    }
  }

  async function handleAppLogout() {
    try {
      setLoggingOutApp(true);
      setError("");

      await fetch("/api/logs/event", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "auth.logout",
          route: window.location.pathname,
        }),
      }).catch(() => null);

      await signOut({ callbackUrl: "/login" });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Nie udało się wylogować z aplikacji.",
      );
      setLoggingOutApp(false);
    }
  }

  async function loadSchedule() {
    try {
      setLoading(true);
      setError("");

      const { accessToken, account } = await getAccessToken();
      setAccount(account);

      const response = await fetch("/api/schedule/load", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ accessToken }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        const details = result?.debug?.response
          ? `\n\nSzczegóły: ${String(result.debug.response).slice(0, 500)}`
          : "";
        throw new Error(
          (result.error || "Nie udało się zaczytać danych.") + details,
        );
      }

      setData(result.data);

      const usersResponse = await fetch("/api/users", {
        method: "GET",
        cache: "no-store",
      });

      const usersResult = await usersResponse.json();

      if (!usersResponse.ok || !usersResult.ok) {
        throw new Error(
          usersResult.error || "Nie udało się pobrać listy użytkowników.",
        );
      }

      setUsers(usersResult.users ?? []);

      if (result.firebase?.savedAt) {
        setLastSync(new Date(result.firebase.savedAt).toLocaleString("pl-PL"));
      } else {
        setLastSync(new Date().toLocaleString("pl-PL"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nieznany błąd.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <div className="mx-auto max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 overflow-hidden rounded-[30px] border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
          <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-300">
                Live sync z OneDrive przez Microsoft Graph
              </div>

              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Grafik pracy
              </h1>

              <p className="mt-2 max-w-2xl text-sm text-zinc-400 sm:text-base">
                Nowoczesny widok grafiku z ręcznym odświeżaniem danych z Excela
                online.
              </p>

              <p className="mt-2 text-xs text-zinc-500">
                {status === "loading"
                  ? "Sprawdzanie sesji..."
                  : session?.user
                    ? `Zalogowano do aplikacji jako: ${session.user.username}`
                    : "Brak sesji aplikacji"}
              </p>

              {canLoadExcel ? (
                <p className="mt-1 text-xs text-zinc-500">
                  {account
                    ? `Microsoft: ${account.username}`
                    : "Microsoft: nie jesteś zalogowany"}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col items-start gap-3 lg:items-end">
              <div className="flex flex-wrap gap-3">
                {canLoadExcel ? (
                  !account ? (
                    <button
                      onClick={handleLogin}
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                    >
                      <LogIn className="h-4 w-4" />
                      Zaloguj Microsoft
                    </button>
                  ) : (
                    <button
                      onClick={handleMicrosoftLogout}
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                    >
                      <LogOut className="h-4 w-4" />
                      Wyloguj Microsoft
                    </button>
                  )
                ) : null}

                {canManageEmployees ? (
                  <Link
                    href="/users"
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    <Settings2 className="h-4 w-4" />
                    Użytkownicy
                  </Link>
                ) : null}

                {canManageAccounts ? (
                  <Link
                    href="/accounts"
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    <Shield className="h-4 w-4" />
                    Konta
                  </Link>
                ) : null}

                {canReadLogs ? (
                  <Link
                    href="/logs"
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    <FileText className="h-4 w-4" />
                    Logi
                  </Link>
                ) : null}

                {canEditSchedule ? (
                  <Link
                    href="/edit"
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    <Pencil className="h-4 w-4" />
                    Edytuj grafik
                  </Link>
                ) : null}

                {canLoadExcel ? (
                  <button
                    onClick={loadSchedule}
                    disabled={loading}
                    className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:scale-[1.01] hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <RefreshCw
                      className={clsx("h-4 w-4", loading && "animate-spin")}
                    />
                    {loading ? "Zaczytywanie..." : "Zaczytaj dane"}
                  </button>
                ) : null}

                <button
                  onClick={handleAppLogout}
                  disabled={loggingOutApp}
                  className="inline-flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-100 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ShieldX className="h-4 w-4" />
                  {loggingOutApp ? "Wylogowywanie..." : "Wyloguj z aplikacji"}
                </button>
              </div>

              <div className="text-xs text-zinc-500">
                {lastSync
                  ? `Ostatnia synchronizacja: ${lastSync}`
                  : "Brak synchronizacji"}
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <div className="mb-6 whitespace-pre-wrap rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={<CalendarDays className="h-4 w-4" />}
            label="Dni w grafiku"
            value={String(data?.rows.length ?? 0)}
          />
          <StatCard
            icon={<Users className="h-4 w-4" />}
            label="Widoczni pracownicy"
            value={String(allowedUsers.length)}
          />
          <StatCard
            icon={<Sun className="h-4 w-4" />}
            label="wsp8"
            value={String(shiftCounts["wsp8"] ?? 0)}
          />
          <StatCard
            icon={<Moon className="h-4 w-4" />}
            label="II dyżur"
            value={String(shiftCounts["II dyżur"] ?? 0)}
          />
        </div>

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
          {[
            "I dyżur",
            "wsp7",
            "wsp8",
            "wsp9",
            "II dyżur",
            "IV dyżur",
            "urlop",
            "wolne",
          ].map((shift) => (
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
            <h2 className="text-lg font-semibold">Podgląd grafiku</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Dane pochodzą z ostatniego importu zapisanego w Firebase.
            </p>
          </div>

          {initialLoading ? (
            <div className="px-6 py-16 text-center text-zinc-500">
              Trwa wczytywanie ostatniego zapisu z Firebase...
            </div>
          ) : !data ? (
            <div className="px-6 py-16 text-center text-zinc-500">
              {canLoadExcel ? (
                <>
                  Kliknij{" "}
                  <span className="font-medium text-zinc-300">
                    „Zaczytaj dane”
                  </span>
                  , aby pobrać grafik z Excela i zapisać go w Firebase.
                </>
              ) : (
                "Grafik nie został jeszcze zaczytany."
              )}
            </div>
          ) : !visibleUsers.length ? (
            <div className="px-6 py-16 text-center text-zinc-500">
              Brak aktywnych użytkowników dopasowanych do Excela.
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
                          const value = row.employees[user.excelName];

                          return (
                            <td
                              key={`${row.date}-${user.id}`}
                              className="border-b border-white/10 px-3 py-3"
                            >
                              {value ? (
                                <span
                                  className={clsx(
                                    "inline-flex min-w-[92px] items-center justify-center rounded-xl px-3 py-2 text-xs font-medium",
                                    getShiftClass(value),
                                  )}
                                >
                                  {value}
                                </span>
                              ) : (
                                <span className="text-xs text-zinc-600">—</span>
                              )}
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

        <div className="mt-6 grid gap-4 lg:grid-cols-4">
          <BottomCard
            icon={<Clock3 className="h-4 w-4" />}
            title="I dyżur"
            value={String(shiftCounts["I dyżur"] ?? 0)}
          />
          <BottomCard
            icon={<Sun className="h-4 w-4" />}
            title="wsp8"
            value={String(shiftCounts["wsp8"] ?? 0)}
          />
          <BottomCard
            icon={<Moon className="h-4 w-4" />}
            title="IV dyżur"
            value={String(shiftCounts["IV dyżur"] ?? 0)}
          />
          <BottomCard
            icon={<Plane className="h-4 w-4" />}
            title="Urlop"
            value={String(shiftCounts["urlop"] ?? 0)}
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/5 px-5 py-5">
      <div className="mb-3 inline-flex rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-300">
        {icon}
      </div>
      <div className="text-3xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-sm text-zinc-400">{label}</div>
    </div>
  );
}

function BottomCard({
  icon,
  title,
  value,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
      <div className="mb-3 inline-flex rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-300">
        {icon}
      </div>
      <div className="flex items-end justify-between gap-4">
        <h3 className="text-base font-semibold">{title}</h3>
        <div className="text-3xl font-semibold tracking-tight">{value}</div>
      </div>
    </div>
  );
}
