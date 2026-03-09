"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  RefreshCw,
  Shield,
  Search,
  User,
  Activity,
  Globe,
  Monitor,
  CalendarDays,
  FileText,
} from "lucide-react";
import type { AuditLogRecord } from "@/types/audit";

function formatMeta(meta: Record<string, unknown> | null | undefined) {
  if (!meta) return "";
  return JSON.stringify(meta, null, 2);
}

function formatUserAgent(userAgent: string | null | undefined) {
  if (!userAgent) return "brak";

  if (userAgent.includes("Chrome")) return `Chrome · ${userAgent}`;
  if (userAgent.includes("Firefox")) return `Firefox · ${userAgent}`;
  if (userAgent.includes("Safari")) return `Safari · ${userAgent}`;

  return userAgent;
}

export default function LogsViewer() {
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function loadLogs(withRefreshState = false) {
    try {
      if (withRefreshState) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const searchParams = new URLSearchParams();

      if (search.trim()) searchParams.set("search", search.trim());
      if (statusFilter) searchParams.set("status", statusFilter);
      if (actionFilter) searchParams.set("action", actionFilter);
      if (categoryFilter) searchParams.set("category", categoryFilter);
      if (from) searchParams.set("from", from);
      if (to) searchParams.set("to", to);

      const response = await fetch(`/api/logs?${searchParams.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Nie udało się pobrać logów.");
      }

      setLogs(result.logs ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nieznany błąd.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadLogs();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!loading) {
        void loadLogs(true);
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [search, statusFilter, actionFilter, categoryFilter, from, to]);

  const availableActions = useMemo(() => {
    return [...new Set(logs.map((log) => log.action))].sort((a, b) =>
      a.localeCompare(b, "pl"),
    );
  }, [logs]);

  const availableCategories = useMemo(() => {
    return [...new Set(logs.map((log) => log.category))].sort((a, b) =>
      a.localeCompare(b, "pl"),
    );
  }, [logs]);

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <div className="mx-auto max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 overflow-hidden rounded-[30px] border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
          <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-300">
                Audit logs v2
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
                  Logi
                </h1>
              </div>

              <p className="mt-2 max-w-3xl text-sm text-zinc-400 sm:text-base">
                Historia logowań, wejść na podstrony oraz najważniejszych zmian
                w systemie.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <MiniStat label="Wszystkie logi" value={String(logs.length)} />
              <MiniStat
                label="Success"
                value={String(
                  logs.filter((log) => log.status === "success").length,
                )}
              />
              <MiniStat
                label="Failure"
                value={String(
                  logs.filter((log) => log.status === "failure").length,
                )}
              />
            </div>
          </div>
        </div>

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="mb-6 grid gap-3 xl:grid-cols-[1fr_220px_260px_220px_220px_220px_auto]">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
            <Search className="h-4 w-4 text-zinc-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Szukaj po użytkowniku, akcji, IP, trasie..."
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
          >
            <option value="">Wszystkie statusy</option>
            <option value="success">success</option>
            <option value="failure">failure</option>
          </select>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
          >
            <option value="">Wszystkie akcje</option>
            {availableActions.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
          >
            <option value="">Wszystkie kategorie</option>
            {availableCategories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>

          <input
            type="datetime-local"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
          />

          <input
            type="datetime-local"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
          />

          <button
            onClick={() => loadLogs(true)}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"}
            />
            {refreshing ? "Odświeżanie..." : "Odśwież"}
          </button>
        </div>

        <div className="overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.04]">
          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="text-lg font-semibold">Historia zdarzeń</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Najnowsze logi są na górze.
            </p>
          </div>

          {loading ? (
            <div className="px-6 py-16 text-center text-zinc-500">
              Wczytywanie logów...
            </div>
          ) : !logs.length ? (
            <div className="px-6 py-16 text-center text-zinc-500">
              Brak logów pasujących do filtrów.
            </div>
          ) : (
            <div className="space-y-4 p-4">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        log.status === "success"
                          ? "bg-emerald-500/10 text-emerald-200"
                          : "bg-red-500/10 text-red-200"
                      }`}
                    >
                      {log.status}
                    </span>

                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
                      {log.category}
                    </span>

                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
                      {log.action}
                    </span>
                  </div>

                  <div className="mb-4 text-base font-semibold text-white">
                    {log.message}
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-3 text-sm text-zinc-300">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-zinc-400" />
                        <span>
                          Użytkownik:{" "}
                          <span className="font-medium text-white">
                            {log.actorUsername ?? "brak"}
                          </span>
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-zinc-400" />
                        <span>
                          Dotyczy:{" "}
                          <span className="font-medium text-white">
                            {log.targetName ??
                              log.entityLabel ??
                              log.entityId ??
                              "brak"}
                          </span>
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-zinc-400" />
                        <span>
                          Data:{" "}
                          <span className="font-medium text-white">
                            {new Date(log.createdAt).toLocaleString("pl-PL")}
                          </span>
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-zinc-400" />
                        <span>
                          IP:{" "}
                          <span className="font-medium text-white">
                            {log.ip ?? "brak"}
                          </span>
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-zinc-400" />
                        <span>
                          Trasa:{" "}
                          <span className="font-medium text-white">
                            {log.route ?? "brak"}
                          </span>
                        </span>
                      </div>

                      <div className="flex items-start gap-2">
                        <Monitor className="mt-0.5 h-4 w-4 text-zinc-400" />
                        <span>
                          Urządzenie / przeglądarka:{" "}
                          <span className="font-medium text-white break-all">
                            {formatUserAgent(log.userAgent)}
                          </span>
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 text-sm font-medium text-zinc-300">
                        Szczegóły techniczne
                      </div>
                      <pre className="overflow-auto rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-zinc-400">
                        {formatMeta(log.meta) || "—"}
                      </pre>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
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
