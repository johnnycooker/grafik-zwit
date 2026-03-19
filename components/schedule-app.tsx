// components/schedule-app.tsx

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  CalendarDays,
  Users,
  RefreshCw,
  Search,
  LogIn,
  LogOut,
  Pencil,
  Settings2,
  ShieldX,
  Shield,
  FileText,
  Briefcase,
  UserRoundX,
  ArrowRight,
  UserCircle2,
  Layers3,
} from "lucide-react";
import { msalInstance, graphScopes } from "@/lib/msal";
import type { AccountInfo, SilentRequest } from "@azure/msal-browser";
import type { ScheduleData } from "@/lib/parse-schedule";
import type { ScheduleUser, TeamGroup } from "@/lib/schedule-users.shared";
import { resolveVisibleUsers } from "@/lib/schedule-visible-users";
import { useSession, signOut } from "next-auth/react";
import type { AppPermission } from "@/types/auth";

const MIN_IMPORT_DATE = "2026-01-01";
const DEFAULT_DAYS_BACK = 14;

const SHIFT_STYLES: Record<string, string> = {
  "I dyżur":
    "border-emerald-400/25 bg-emerald-500/18 text-emerald-200 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.10)]",
  "II dyżur":
    "border-amber-400/25 bg-amber-500/18 text-amber-200 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.10)]",
  "IV dyżur":
    "border-rose-400/25 bg-rose-500/18 text-rose-200 shadow-[inset_0_0_0_1px_rgba(251,113,133,0.10)]",
  wsp7: "border-sky-400/25 bg-sky-500/18 text-sky-200 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.10)]",
  wsp8: "border-violet-400/25 bg-violet-500/18 text-violet-200 shadow-[inset_0_0_0_1px_rgba(167,139,250,0.10)]",
  wsp9: "border-indigo-400/25 bg-indigo-500/18 text-indigo-200 shadow-[inset_0_0_0_1px_rgba(99,102,241,0.10)]",
  urlop:
    "border-green-400/25 bg-green-500/18 text-green-200 shadow-[inset_0_0_0_1px_rgba(74,222,128,0.10)]",
  wolne:
    "border-zinc-400/20 bg-zinc-500/14 text-zinc-200 shadow-[inset_0_0_0_1px_rgba(161,161,170,0.06)]",
  L4: "border-red-400/25 bg-red-500/18 text-red-200 shadow-[inset_0_0_0_1px_rgba(248,113,113,0.10)]",
};

const GROUP_LABELS: Record<TeamGroup, string> = {
  KORD: "Koord",
  SYS: "SYS",
  POS: "POS",
  HAN: "HAN",
};

type DashboardPerson = {
  id: string;
  name: string;
  shift: string;
};

type AbsencePerson = {
  id: string;
  name: string;
  reason: string;
};

function getShiftClass(value: string) {
  return (
    SHIFT_STYLES[value] ??
    "border-white/10 bg-white/5 text-zinc-200 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
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

function hasAppPermission(
  permissions: AppPermission[] | undefined,
  permission: AppPermission,
) {
  if (!permissions) return false;
  return permissions.includes(permission);
}

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysToIsoDate(isoDate: string, days: number) {
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  parsed.setDate(parsed.getDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function clampImportDate(value: string) {
  if (!value) return MIN_IMPORT_DATE;
  if (value < MIN_IMPORT_DATE) return MIN_IMPORT_DATE;
  return value;
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("pl-PL");
}

function isWorkShift(value: string) {
  return ["I dyżur", "II dyżur", "IV dyżur", "wsp7", "wsp8", "wsp9"].includes(
    value,
  );
}

function isAbsenceShift(value: string) {
  const normalized = normalizeText(value);
  return (
    normalized === "urlop" ||
    normalized === "wolne" ||
    normalized === "l4" ||
    normalized.includes("l4")
  );
}

function normalizeAbsenceLabel(value: string) {
  const normalized = normalizeText(value);
  if (normalized.includes("l4")) return "L4";
  if (normalized === "urlop") return "urlop";
  if (normalized === "wolne") return "wolne";
  return value;
}

function getRowsForDefaultViewport(rows: ScheduleData["rows"]) {
  if (!rows.length) return rows;

  const today = getTodayIsoDate();
  const maxRowDate = rows[rows.length - 1]?.date ?? today;

  let anchorDate = today;

  if (today > maxRowDate) {
    anchorDate = maxRowDate;
  } else if (today < rows[0].date) {
    anchorDate = rows[0].date;
  }

  const fromDate = addDaysToIsoDate(anchorDate, -DEFAULT_DAYS_BACK);

  return rows.filter((row) => row.date >= fromDate);
}

function getTargetDateForViewport(rows: ScheduleData["rows"]) {
  if (!rows.length) return "";

  const today = getTodayIsoDate();
  const exact = rows.find((row) => row.date === today);
  if (exact) return exact.date;

  const firstFuture = rows.find((row) => row.date > today);
  if (firstFuture) return firstFuture.date;

  const latestPast = [...rows].reverse().find((row) => row.date < today);
  return latestPast?.date ?? rows[0].date;
}

function getShiftCountsForRow(
  row: ScheduleData["rows"][number] | null | undefined,
  users: ScheduleUser[],
) {
  const counts: Record<string, number> = {};
  if (!row) return counts;

  for (const user of users) {
    const shift = row.employees[user.excelName];
    if (!shift || !isWorkShift(shift)) continue;
    counts[shift] = (counts[shift] || 0) + 1;
  }

  return counts;
}

function getPeopleForGroupOnRow(
  row: ScheduleData["rows"][number] | null | undefined,
  users: ScheduleUser[],
  group: TeamGroup,
): DashboardPerson[] {
  if (!row) return [];

  return users
    .filter((user) => user.group === group)
    .map((user) => ({
      id: user.id,
      name: user.displayName,
      shift: row.employees[user.excelName] ?? "",
    }))
    .filter((item) => item.shift && isWorkShift(item.shift))
    .sort((a, b) => a.name.localeCompare(b.name, "pl"));
}

function getAbsencesForRow(
  row: ScheduleData["rows"][number] | null | undefined,
  users: ScheduleUser[],
): AbsencePerson[] {
  if (!row) return [];

  return users
    .map((user) => {
      const shift = row.employees[user.excelName] ?? "";
      return {
        id: user.id,
        name: user.displayName,
        reason: shift,
      };
    })
    .filter((item) => item.reason && isAbsenceShift(item.reason))
    .map((item) => ({
      ...item,
      reason: normalizeAbsenceLabel(item.reason),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "pl"));
}

function getUpcomingAbsences(
  data: ScheduleData | null,
  users: ScheduleUser[],
  fromDate: string,
  limit = 8,
) {
  if (!data) return [];

  const items: Array<{
    id: string;
    name: string;
    date: string;
    reason: string;
  }> = [];

  for (const row of data.rows) {
    if (row.date <= fromDate) continue;

    for (const user of users) {
      const shift = row.employees[user.excelName] ?? "";
      if (!shift || !isAbsenceShift(shift)) continue;

      items.push({
        id: `${row.date}-${user.id}`,
        name: user.displayName,
        date: row.date,
        reason: normalizeAbsenceLabel(shift),
      });
    }
  }

  return items.slice(0, limit);
}

function tryResolveCurrentScheduleUser(
  sessionUsername: string | undefined,
  users: ScheduleUser[],
) {
  if (!sessionUsername) return null;

  const normalizedUsername = normalizeText(sessionUsername);

  const direct = users.find(
    (user) =>
      normalizeText(user.excelName) === normalizedUsername ||
      normalizeText(user.displayName) === normalizedUsername,
  );

  if (direct) return direct;

  const compact = normalizedUsername.replace(/\s+/g, "");
  const dotted = normalizedUsername.replace(/_/g, ".").replace(/\s+/g, ".");

  return (
    users.find((user) => {
      const first = normalizeText(user.firstName);
      const last = normalizeText(user.lastName);
      const full = `${first}.${last}`;
      const reverse = `${last}.${first}`;
      const compactFull = `${first}${last}`;
      const compactReverse = `${last}${first}`;

      return (
        full === dotted ||
        reverse === dotted ||
        compactFull === compact ||
        compactReverse === compact ||
        last === normalizedUsername ||
        first === normalizedUsername
      );
    }) ?? null
  );
}

function getMyUpcomingPlan(
  data: ScheduleData | null,
  user: ScheduleUser | null,
  fromDate: string,
  limit = 6,
) {
  if (!data || !user) return [];

  return data.rows
    .filter((row) => row.date >= fromDate)
    .map((row) => ({
      date: row.date,
      shift: row.employees[user.excelName] ?? "",
    }))
    .filter((item) => Boolean(item.shift))
    .slice(0, limit);
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
  const [importUntilDate, setImportUntilDate] = useState("");
  const [loadedUntil, setLoadedUntil] = useState("");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");

  const tableContainerRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  const todayIso = getTodayIsoDate();

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

        const nextData = currentResult.data ?? null;
        setData(nextData);
        setUsers(usersResult.users ?? []);

        if (currentResult.meta?.savedAt) {
          setLastSync(
            new Date(currentResult.meta.savedAt).toLocaleString("pl-PL"),
          );
        } else {
          setLastSync("");
        }

        const currentLoadedUntil =
          typeof currentResult.meta?.loadedUntil === "string"
            ? currentResult.meta.loadedUntil
            : "";

        setLoadedUntil(currentLoadedUntil);

        if (currentLoadedUntil) {
          setImportUntilDate(clampImportDate(currentLoadedUntil));
        } else {
          setImportUntilDate(clampImportDate(getTodayIsoDate()));
        }

        setRangeFrom("");
        setRangeTo("");
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

  const visibleUsers = useMemo(() => {
    const base = employeeFilter
      ? allowedUsers.filter((user) => user.id === employeeFilter)
      : allowedUsers;

    if (!search.trim()) return base;

    return base.filter((user) =>
      user.displayName.toLowerCase().includes(search.toLowerCase()),
    );
  }, [allowedUsers, employeeFilter, search]);

  const visibleRows = useMemo(() => {
    if (!data) return [];

    if (rangeFrom || rangeTo) {
      return data.rows.filter((row) => {
        if (rangeFrom && row.date < rangeFrom) return false;
        if (rangeTo && row.date > rangeTo) return false;
        return true;
      });
    }

    return getRowsForDefaultViewport(data.rows);
  }, [data, rangeFrom, rangeTo]);

  useEffect(() => {
    const container = tableContainerRef.current;
    if (!container || !visibleRows.length) return;

    requestAnimationFrame(() => {
      const targetDate = getTargetDateForViewport(visibleRows);
      const targetRow = rowRefs.current[targetDate];

      if (targetRow) {
        const rowHeight = targetRow.offsetHeight || 34;
        const offsetForTwoRowsAbove = rowHeight * 2;
        container.scrollTop = Math.max(
          targetRow.offsetTop - offsetForTwoRowsAbove,
          0,
        );
      }
    });
  }, [visibleRows]);

  const todayRow = useMemo(
    () => data?.rows.find((row) => row.date === todayIso) ?? null,
    [data, todayIso],
  );

  const tomorrowIso = useMemo(() => addDaysToIsoDate(todayIso, 1), [todayIso]);

  const tomorrowRow = useMemo(
    () => data?.rows.find((row) => row.date === tomorrowIso) ?? null,
    [data, tomorrowIso],
  );

  const todayWorkCounts = useMemo(
    () => getShiftCountsForRow(todayRow, allowedUsers),
    [todayRow, allowedUsers],
  );

  const todayAtWorkCount = useMemo(
    () => Object.values(todayWorkCounts).reduce((sum, value) => sum + value, 0),
    [todayWorkCounts],
  );

  const tomorrowWorkCounts = useMemo(
    () => getShiftCountsForRow(tomorrowRow, allowedUsers),
    [tomorrowRow, allowedUsers],
  );

  const tomorrowAtWorkCount = useMemo(
    () =>
      Object.values(tomorrowWorkCounts).reduce((sum, value) => sum + value, 0),
    [tomorrowWorkCounts],
  );

  const todayGroups = useMemo(
    () => ({
      KORD: getPeopleForGroupOnRow(todayRow, allowedUsers, "KORD"),
      SYS: getPeopleForGroupOnRow(todayRow, allowedUsers, "SYS"),
      POS: getPeopleForGroupOnRow(todayRow, allowedUsers, "POS"),
      HAN: getPeopleForGroupOnRow(todayRow, allowedUsers, "HAN"),
    }),
    [todayRow, allowedUsers],
  );

  const todayAbsences = useMemo(
    () => getAbsencesForRow(todayRow, allowedUsers),
    [todayRow, allowedUsers],
  );

  const upcomingAbsences = useMemo(
    () => getUpcomingAbsences(data, allowedUsers, todayIso, 8),
    [data, allowedUsers, todayIso],
  );

  const currentScheduleUser = useMemo(
    () => tryResolveCurrentScheduleUser(session?.user?.username, allowedUsers),
    [session?.user?.username, allowedUsers],
  );

  const myUpcomingPlan = useMemo(
    () => getMyUpcomingPlan(data, currentScheduleUser, todayIso, 6),
    [data, currentScheduleUser, todayIso],
  );

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
      setLoadedUntil("");
      setRangeFrom("");
      setRangeTo("");

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
      const safeImportUntilDate = clampImportDate(importUntilDate);

      if (!safeImportUntilDate) {
        throw new Error(
          "Wybierz datę końcową importu przed zaczytaniem danych.",
        );
      }

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
        body: JSON.stringify({
          accessToken,
          maxDate: safeImportUntilDate,
        }),
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

      const nextData = result.data as ScheduleData;
      setData(nextData);
      setImportUntilDate(safeImportUntilDate);
      setRangeFrom("");
      setRangeTo("");

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

      const nextLoadedUntil =
        typeof result.data?.meta?.loadedUntil === "string"
          ? result.data.meta.loadedUntil
          : safeImportUntilDate;

      setLoadedUntil(nextLoadedUntil);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nieznany błąd.");
    } finally {
      setLoading(false);
    }
  }

  function handleResetDateRange() {
    setRangeFrom("");
    setRangeTo("");
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <div className="mx-auto max-w-[99vw] px-3 py-6 sm:px-4 lg:px-6">
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

              {loadedUntil ? (
                <p className="mt-1 text-xs text-zinc-500">
                  Aktualnie zaczytany zakres do: {loadedUntil}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col items-start gap-3 lg:items-end">
              {canLoadExcel ? (
                <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <label className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">
                    Zaczytaj grafik do daty
                  </label>
                  <input
                    type="date"
                    min={MIN_IMPORT_DATE}
                    value={importUntilDate}
                    onChange={(e) =>
                      setImportUntilDate(clampImportDate(e.target.value))
                    }
                    className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                  />
                </div>
              ) : null}

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
                    disabled={loading || !importUntilDate}
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

        <div className="mb-6 grid gap-4 xl:grid-cols-[1.2fr_1fr]">
          <DashboardCard
            icon={<Briefcase className="h-4 w-4" />}
            title="Dzisiaj w pracy"
            subtitle={todayRow ? todayRow.date : "Brak danych na dziś"}
          >
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <div className="text-4xl font-semibold tracking-tight">
                  {todayAtWorkCount}
                </div>
                <div className="mt-1 text-sm text-zinc-400">
                  osób na zmianie
                </div>
              </div>

              <div className="text-right text-sm text-zinc-500">
                {todayRow ? `Plan na ${getWeekdayLabel(todayRow.date)}` : "—"}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
              {["I dyżur", "II dyżur", "IV dyżur", "wsp7", "wsp8", "wsp9"].map(
                (shift) => (
                  <CountBadge
                    key={shift}
                    label={shift}
                    value={todayWorkCounts[shift] ?? 0}
                    toneClass={getShiftClass(shift)}
                  />
                ),
              )}
            </div>
          </DashboardCard>

          <DashboardCard
            icon={<ArrowRight className="h-4 w-4" />}
            title="Jutro w pracy"
            subtitle={tomorrowRow ? tomorrowRow.date : "Brak danych na jutro"}
          >
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <div className="text-4xl font-semibold tracking-tight">
                  {tomorrowAtWorkCount}
                </div>
                <div className="mt-1 text-sm text-zinc-400">
                  osób zaplanowanych
                </div>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
              {["I dyżur", "II dyżur", "IV dyżur", "wsp7", "wsp8", "wsp9"].map(
                (shift) => (
                  <CountBadge
                    key={shift}
                    label={shift}
                    value={tomorrowWorkCounts[shift] ?? 0}
                    toneClass={getShiftClass(shift)}
                  />
                ),
              )}
            </div>
          </DashboardCard>
        </div>

        <div className="mb-6 grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
          {(Object.keys(todayGroups) as TeamGroup[]).map((group) => (
            <PeopleShiftCard
              key={group}
              title={`${GROUP_LABELS[group]} dziś`}
              people={todayGroups[group]}
            />
          ))}
        </div>

        <div className="mb-6 grid gap-4 xl:grid-cols-[1fr_1fr_1fr]">
          <DashboardCard
            icon={<UserRoundX className="h-4 w-4" />}
            title="Nieobecni dziś"
            subtitle="Urlop, L4 i wolne"
          >
            {todayAbsences.length ? (
              <div className="space-y-2">
                {todayAbsences.map((person) => (
                  <PersonRow
                    key={person.id}
                    name={person.name}
                    value={person.reason}
                    valueClass={getShiftClass(person.reason)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState text="Dzisiaj nikt nie jest oznaczony jako nieobecny." />
            )}
          </DashboardCard>

          <DashboardCard
            icon={<CalendarDays className="h-4 w-4" />}
            title="Najbliższe nieobecności"
            subtitle="Kolejne wpisy w grafiku"
          >
            {upcomingAbsences.length ? (
              <div className="space-y-2">
                {upcomingAbsences.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-white">
                        {item.name}
                      </div>
                      <div className="text-xs text-zinc-500">{item.date}</div>
                    </div>

                    <span
                      className={clsx(
                        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
                        getShiftClass(item.reason),
                      )}
                    >
                      {item.reason}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState text="Brak najbliższych nieobecności w aktualnym zakresie." />
            )}
          </DashboardCard>

          <DashboardCard
            icon={<UserCircle2 className="h-4 w-4" />}
            title="Twój najbliższy plan"
            subtitle={
              currentScheduleUser
                ? currentScheduleUser.displayName
                : "Nie udało się dopasować konta do pracownika"
            }
          >
            {currentScheduleUser ? (
              myUpcomingPlan.length ? (
                <div className="space-y-2">
                  {myUpcomingPlan.map((item) => (
                    <div
                      key={`${item.date}-${item.shift}`}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2"
                    >
                      <div className="text-sm font-medium text-white">
                        {item.date}
                      </div>

                      <span
                        className={clsx(
                          "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
                          getShiftClass(item.shift),
                        )}
                      >
                        {item.shift}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState text="Brak kolejnych wpisów dla Twojego konta w aktualnym zakresie." />
              )
            ) : (
              <EmptyState text="Dodaj spójne mapowanie loginu do pracownika, aby ten widget zawsze trafiał w odpowiednią osobę." />
            )}
          </DashboardCard>
        </div>

        {error ? (
          <div className="mb-6 whitespace-pre-wrap rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_220px]">
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

        <div className="mb-4 rounded-[24px] border border-white/10 bg-white/[0.04] px-4 py-4">
          <div className="mb-3 text-sm font-semibold text-white">
            Filtr zakresu dat
          </div>

          <div className="grid gap-3 lg:grid-cols-[220px_220px_auto]">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-400">
                Data od
              </label>
              <input
                type="date"
                min={MIN_IMPORT_DATE}
                max={rangeTo || loadedUntil || undefined}
                value={rangeFrom}
                onChange={(e) => setRangeFrom(e.target.value)}
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-400">
                Data do
              </label>
              <input
                type="date"
                min={rangeFrom || MIN_IMPORT_DATE}
                max={loadedUntil || undefined}
                value={rangeTo}
                onChange={(e) => setRangeTo(e.target.value)}
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
              />
            </div>

            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setRangeFrom("");
                  setRangeTo("");
                }}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Resetuj zakres
              </button>

              <div className="text-xs text-zinc-500">
                Pokazuję {visibleRows.length} dni.
              </div>
            </div>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {[
              "I dyżur",
              "wsp7",
              "wsp8",
              "wsp9",
              "II dyżur",
              "IV dyżur",
              "urlop",
              "wolne",
              "L4",
            ].map((shift) => (
              <span
                key={shift}
                className={clsx(
                  "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium",
                  getShiftClass(shift),
                )}
              >
                {shift}
              </span>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.04] shadow-[0_20px_90px_rgba(0,0,0,0.28)] backdrop-blur">
          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="text-lg font-semibold">Podgląd grafiku</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Domyślnie widzisz dziś jako 3. wiersz od góry, z 2 poprzednimi
              dniami nad nim. Starsze okresy sprawdzisz filtrem dat.
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
                  Wybierz datę końcową importu i kliknij{" "}
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
          ) : !visibleRows.length ? (
            <div className="px-6 py-16 text-center text-zinc-500">
              Brak danych dla wybranego zakresu dat.
            </div>
          ) : (
            <div ref={tableContainerRef} className="max-h-[78vh] overflow-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead className="sticky top-0 z-30">
                  <tr>
                    <th className="sticky left-0 z-40 border-b border-r border-white/10 bg-zinc-950/95 px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400 backdrop-blur">
                      Data
                    </th>

                    {visibleUsers.map((user, index) => (
                      <th
                        key={user.id}
                        className={clsx(
                          "border-b bg-zinc-950/95 px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400 backdrop-blur",
                          index === visibleUsers.length - 1
                            ? "border-white/10"
                            : "border-r border-white/8",
                        )}
                      >
                        <div className="mx-auto min-w-[78px] max-w-[88px] truncate">
                          {user.displayName}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {visibleRows.map((row) => {
                    const weekend = isWeekend(row.date);
                    const isToday = row.date === todayIso;

                    return (
                      <tr
                        key={row.date}
                        ref={(element) => {
                          rowRefs.current[row.date] = element;
                        }}
                        className={clsx(
                          isToday
                            ? "bg-emerald-500/[0.12] shadow-[inset_0_2px_0_rgba(74,222,128,0.55),inset_0_-2px_0_rgba(74,222,128,0.55)]"
                            : weekend
                              ? "bg-amber-500/[0.08]"
                              : "bg-transparent hover:bg-white/[0.02]",
                        )}
                      >
                        <td
                          className={clsx(
                            "sticky left-0 z-20 border-b border-r px-3 py-1.5 align-middle",
                            isToday
                              ? "border-emerald-400/35 bg-[linear-gradient(90deg,rgba(34,197,94,0.26)_0%,rgba(24,24,27,0.98)_58%,rgba(24,24,27,0.98)_100%)]"
                              : weekend
                                ? "border-white/10 bg-[linear-gradient(90deg,rgba(245,158,11,0.12)_0%,rgba(24,24,27,0.96)_55%,rgba(24,24,27,0.96)_100%)]"
                                : "border-white/10 bg-zinc-950",
                          )}
                        >
                          <div className="flex min-h-[34px] flex-col items-center justify-center leading-tight">
                            <span
                              className={clsx(
                                "text-[11px] font-semibold",
                                isToday ? "text-emerald-200" : "text-white",
                              )}
                            >
                              {row.date}
                            </span>
                            <span
                              className={clsx(
                                "mt-0.5 text-[10px] uppercase tracking-wide",
                                isToday
                                  ? "text-emerald-300"
                                  : weekend
                                    ? "text-amber-300"
                                    : "text-zinc-500",
                              )}
                            >
                              {isToday
                                ? `${getWeekdayLabel(row.date)} · dziś`
                                : getWeekdayLabel(row.date)}
                            </span>
                          </div>
                        </td>

                        {visibleUsers.map((user, index) => {
                          const value = row.employees[user.excelName];

                          return (
                            <td
                              key={`${row.date}-${user.id}`}
                              className={clsx(
                                "border-b px-2 py-1.5 align-middle",
                                index === visibleUsers.length - 1
                                  ? isToday
                                    ? "border-emerald-400/20"
                                    : "border-white/10"
                                  : isToday
                                    ? "border-r border-emerald-400/15"
                                    : "border-r border-white/8",
                                isToday
                                  ? "border-b-emerald-400/20"
                                  : weekend
                                    ? "border-b-amber-500/10"
                                    : "border-b-white/8",
                              )}
                            >
                              <div className="flex min-h-[34px] items-center justify-center">
                                {value ? (
                                  <span
                                    className={clsx(
                                      "inline-flex min-w-[76px] items-center justify-center rounded-lg border px-2.5 py-1 text-center text-[11px] font-medium leading-none",
                                      getShiftClass(value),
                                      isToday && "ring-1 ring-emerald-400/20",
                                    )}
                                  >
                                    {value}
                                  </span>
                                ) : (
                                  <span className="inline-flex min-w-[76px] items-center justify-center text-center text-[12px] leading-none text-zinc-600">
                                    —
                                  </span>
                                )}
                              </div>
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
      </div>
    </div>
  );
}

function DashboardCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_20px_90px_rgba(0,0,0,0.20)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="mb-2 inline-flex rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-300">
            {icon}
          </div>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          {subtitle ? (
            <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
          ) : null}
        </div>
      </div>

      {children}
    </div>
  );
}

function CountBadge({
  label,
  value,
  toneClass,
}: {
  label: string;
  value: number;
  toneClass: string;
}) {
  return (
    <div className={clsx("rounded-2xl border px-3 py-3", toneClass)}>
      <div className="text-[11px] uppercase tracking-wide opacity-80">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold leading-none">{value}</div>
    </div>
  );
}

function PeopleShiftCard({
  title,
  people,
}: {
  title: string;
  people: DashboardPerson[];
}) {
  return (
    <DashboardCard
      icon={<Layers3 className="h-4 w-4" />}
      title={title}
      subtitle="Plan na dziś bez wolnych i nieobecnych"
    >
      {people.length ? (
        <div className="space-y-2">
          {people.map((person) => (
            <PersonRow
              key={person.id}
              name={person.name}
              value={person.shift}
              valueClass={getShiftClass(person.shift)}
            />
          ))}
        </div>
      ) : (
        <EmptyState text="Brak osób na zmianie w tej grupie." />
      )}
    </DashboardCard>
  );
}

function PersonRow({
  name,
  value,
  valueClass,
}: {
  name: string;
  value: string;
  valueClass: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
      <div className="truncate text-sm font-medium text-white">{name}</div>

      <span
        className={clsx(
          "inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-medium",
          valueClass,
        )}
      >
        {value}
      </span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center text-sm text-zinc-500">
      {text}
    </div>
  );
}
