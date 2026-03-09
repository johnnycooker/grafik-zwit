"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  GripHorizontal,
  Pencil,
  Plus,
  Save,
  Trash2,
  Users,
  UserPlus,
  ShieldCheck,
  Shuffle,
  Check,
  X,
} from "lucide-react";
import {
  TEAM_GROUPS,
  type ScheduleUser,
  type TeamGroup,
} from "@/lib/schedule-users.shared";

type UserFormState = {
  firstName: string;
  lastName: string;
  excelName: string;
  group: TeamGroup;
  active: boolean;
};

const DEFAULT_FORM: UserFormState = {
  firstName: "",
  lastName: "",
  excelName: "",
  group: "POS",
  active: true,
};

function groupClass(group: TeamGroup) {
  switch (group) {
    case "POS":
      return "bg-cyan-500/15 text-cyan-300 ring-cyan-500/30";
    case "SYS":
      return "bg-violet-500/15 text-violet-300 ring-violet-500/30";
    case "HAN":
      return "bg-amber-500/15 text-amber-300 ring-amber-500/30";
    case "KORD":
      return "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30";
    default:
      return "bg-white/5 text-zinc-300 ring-white/10";
  }
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={clsx(
        "relative inline-flex h-7 w-12 items-center rounded-full border transition",
        checked
          ? "border-emerald-400/40 bg-emerald-500/20"
          : "border-white/10 bg-white/5",
      )}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 35 }}
        className={clsx(
          "ml-1 inline-block h-5 w-5 rounded-full",
          checked ? "bg-emerald-300" : "bg-zinc-400",
        )}
        style={{
          x: checked ? 20 : 0,
        }}
      />
    </button>
  );
}

function OrderModal({
  user,
  users,
  onClose,
  onSave,
  saving,
}: {
  user: ScheduleUser;
  users: ScheduleUser[];
  onClose: () => void;
  onSave: (payload: { teamOrder: number; groupOrder: number }) => Promise<void>;
  saving: boolean;
}) {
  const [teamOrder, setTeamOrder] = useState(user.teamOrder);
  const [groupOrder, setGroupOrder] = useState(user.groupOrder);

  const sameGroupUsers = useMemo(
    () =>
      users
        .filter((item) => item.group === user.group)
        .sort((a, b) => a.groupOrder - b.groupOrder),
    [user.group, users],
  );

  const teamPreview = useMemo(() => {
    const withoutCurrent = users.filter((item) => item.id !== user.id);
    const next = [...withoutCurrent];
    next.splice(Math.min(teamOrder - 1, next.length), 0, user);

    return next.map((item, index) => ({
      ...item,
      previewOrder: index + 1,
      isCurrent: item.id === user.id,
    }));
  }, [teamOrder, user, users]);

  const groupPreview = useMemo(() => {
    const withoutCurrent = sameGroupUsers.filter((item) => item.id !== user.id);
    const next = [...withoutCurrent];
    next.splice(Math.min(groupOrder - 1, next.length), 0, user);

    return next.map((item, index) => ({
      ...item,
      previewOrder: index + 1,
      isCurrent: item.id === user.id,
    }));
  }, [groupOrder, sameGroupUsers, user]);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 18, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 220, damping: 24 }}
          className="w-full max-w-6xl overflow-hidden rounded-[32px] border border-white/10 bg-[#070709] shadow-[0_40px_160px_rgba(0,0,0,0.55)]"
        >
          <div className="border-b border-white/10 bg-gradient-to-br from-zinc-900 via-black to-zinc-950 px-6 py-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-300">
                  <Shuffle className="h-3.5 w-3.5" />
                  Zmiana kolejności 2026 mode
                </div>
                <h2 className="text-2xl font-semibold text-white">
                  {user.displayName}
                </h2>
                <p className="mt-2 text-sm text-zinc-400">
                  Przesuń użytkownika płynnie. Preview aktualizuje się na żywo i
                  pokazuje, kto wskakuje przed kim.
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
              >
                Zamknij
              </button>
            </div>
          </div>

          <div className="grid gap-6 p-6 lg:grid-cols-2">
            <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Kolejność w grupie
                  </h3>
                  <p className="mt-1 text-sm text-zinc-400">
                    Grupa: <span className="text-zinc-200">{user.group}</span>
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300">
                  Pozycja:{" "}
                  <span className="font-semibold text-white">{groupOrder}</span>{" "}
                  / {sameGroupUsers.length}
                </div>
              </div>

              <input
                type="range"
                min={1}
                max={Math.max(1, sameGroupUsers.length)}
                value={groupOrder}
                onChange={(e) => setGroupOrder(Number(e.target.value))}
                className="mb-5 h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-cyan-400"
              />

              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {groupPreview.map((item) => (
                    <motion.div
                      key={`group-${item.id}`}
                      layout
                      transition={{
                        type: "spring",
                        stiffness: 420,
                        damping: 32,
                      }}
                      initial={{ opacity: 0, y: 18, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -12, scale: 0.98 }}
                      className={clsx(
                        "flex items-center justify-between rounded-2xl border px-4 py-3",
                        item.isCurrent
                          ? "border-cyan-400/40 bg-cyan-500/10 shadow-[0_0_0_1px_rgba(34,211,238,0.15)]"
                          : "border-white/10 bg-white/[0.03]",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={clsx(
                            "flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-semibold",
                            item.isCurrent
                              ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-200"
                              : "border-white/10 bg-white/5 text-zinc-300",
                          )}
                        >
                          {item.previewOrder}
                        </div>

                        <div>
                          <div
                            className={clsx(
                              "font-medium",
                              item.isCurrent ? "text-white" : "text-zinc-200",
                            )}
                          >
                            {item.displayName}
                          </div>
                          <div className="text-xs text-zinc-500">
                            {item.isCurrent
                              ? "To właśnie przesuwasz"
                              : `Było: ${item.groupOrder}`}
                          </div>
                        </div>
                      </div>

                      {item.isCurrent ? (
                        <div className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-200">
                          Live preview
                        </div>
                      ) : null}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </section>

            <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Kolejność w całym zespole
                  </h3>
                  <p className="mt-1 text-sm text-zinc-400">
                    Ustaw układ kolumn od lewej do prawej.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300">
                  Pozycja:{" "}
                  <span className="font-semibold text-white">{teamOrder}</span>{" "}
                  / {users.length}
                </div>
              </div>

              <input
                type="range"
                min={1}
                max={Math.max(1, users.length)}
                value={teamOrder}
                onChange={(e) => setTeamOrder(Number(e.target.value))}
                className="mb-5 h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-violet-400"
              />

              <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
                <AnimatePresence initial={false}>
                  {teamPreview.map((item) => (
                    <motion.div
                      key={`team-${item.id}`}
                      layout
                      transition={{
                        type: "spring",
                        stiffness: 420,
                        damping: 32,
                      }}
                      initial={{ opacity: 0, y: 18, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -12, scale: 0.98 }}
                      className={clsx(
                        "flex items-center justify-between rounded-2xl border px-4 py-3",
                        item.isCurrent
                          ? "border-violet-400/40 bg-violet-500/10 shadow-[0_0_0_1px_rgba(168,85,247,0.15)]"
                          : "border-white/10 bg-white/[0.03]",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={clsx(
                            "flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-semibold",
                            item.isCurrent
                              ? "border-violet-400/40 bg-violet-500/15 text-violet-200"
                              : "border-white/10 bg-white/5 text-zinc-300",
                          )}
                        >
                          {item.previewOrder}
                        </div>

                        <div>
                          <div
                            className={clsx(
                              "font-medium",
                              item.isCurrent ? "text-white" : "text-zinc-200",
                            )}
                          >
                            {item.displayName}
                          </div>
                          <div className="text-xs text-zinc-500">
                            {item.group} · było: {item.teamOrder}
                          </div>
                        </div>
                      </div>

                      <span
                        className={clsx(
                          "rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset",
                          groupClass(item.group),
                        )}
                      >
                        {item.group}
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </section>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 px-6 py-5">
            <div className="text-sm text-zinc-500">
              Po zapisaniu system sam przesunie pozostałych użytkowników.
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Anuluj
              </button>

              <button
                type="button"
                onClick={() => onSave({ teamOrder, groupOrder })}
                disabled={saving}
                className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Zapisywanie..." : "Zapisz kolejność"}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function UsersManager() {
  const [users, setUsers] = useState<ScheduleUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orderSaving, setOrderSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState<UserFormState>(DEFAULT_FORM);
  const [editingUser, setEditingUser] = useState<ScheduleUser | null>(null);
  const [orderUser, setOrderUser] = useState<ScheduleUser | null>(null);

  useEffect(() => {
    async function loadUsers() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch("/api/users", {
          method: "GET",
          cache: "no-store",
        });

        const result = await response.json();

        if (!response.ok || !result.ok) {
          throw new Error(result.error || "Nie udało się pobrać użytkowników.");
        }

        setUsers(result.users ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Nieznany błąd.");
      } finally {
        setLoading(false);
      }
    }

    loadUsers();
  }, []);

  const groupedCounts = useMemo(() => {
    return TEAM_GROUPS.map((group) => ({
      group,
      count: users.filter((user) => user.group === group).length,
    }));
  }, [users]);

  function updateForm<K extends keyof UserFormState>(
    key: K,
    value: UserFormState[K],
  ) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function handleCreate() {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Nie udało się dodać użytkownika.");
      }

      setUsers(result.users ?? []);
      setForm(DEFAULT_FORM);
      setSuccess("Dodano użytkownika.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nieznany błąd.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(user: ScheduleUser) {
    const confirmed = window.confirm(
      `Na pewno usunąć użytkownika ${user.displayName}?`,
    );

    if (!confirmed) return;

    try {
      setError("");
      setSuccess("");

      const response = await fetch(`/api/users/${user.id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Nie udało się usunąć użytkownika.");
      }

      setUsers(result.users ?? []);
      setSuccess("Usunięto użytkownika.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nieznany błąd.");
    }
  }

  async function handleToggleActive(user: ScheduleUser, nextValue: boolean) {
    try {
      setError("");
      setSuccess("");

      const response = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          active: nextValue,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Nie udało się zmienić statusu.");
      }

      setUsers(result.users ?? []);
      setSuccess("Zmieniono status użytkownika.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nieznany błąd.");
    }
  }

  async function handleQuickGroupChange(user: ScheduleUser, group: TeamGroup) {
    try {
      setError("");
      setSuccess("");

      const response = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          group,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Nie udało się zmienić grupy.");
      }

      setUsers(result.users ?? []);
      setSuccess("Zmieniono grupę użytkownika.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nieznany błąd.");
    }
  }

  async function handleEditSave() {
    if (!editingUser) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response = await fetch(`/api/users/${editingUser.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: editingUser.firstName,
          lastName: editingUser.lastName,
          excelName: editingUser.excelName,
          active: editingUser.active,
          group: editingUser.group,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Nie udało się zapisać zmian.");
      }

      setUsers(result.users ?? []);
      setEditingUser(null);
      setSuccess("Zapisano zmiany użytkownika.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nieznany błąd.");
    } finally {
      setSaving(false);
    }
  }

  async function handleOrderSave(payload: {
    teamOrder: number;
    groupOrder: number;
  }) {
    if (!orderUser) return;

    try {
      setOrderSaving(true);
      setError("");
      setSuccess("");

      const response = await fetch("/api/users/reorder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: orderUser.id,
          teamOrder: payload.teamOrder,
          groupOrder: payload.groupOrder,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Nie udało się zapisać kolejności.");
      }

      setUsers(result.users ?? []);
      setOrderUser(null);
      setSuccess("Zapisano nową kolejność.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nieznany błąd.");
    } finally {
      setOrderSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <div className="mx-auto max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 overflow-hidden rounded-[30px] border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
          <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-300">
                Panel użytkowników
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
                  Użytkownicy
                </h1>
              </div>

              <p className="mt-2 max-w-3xl text-sm text-zinc-400 sm:text-base">
                Tutaj strona decyduje, kto ma być widoczny w grafiku, do jakiej
                grupy należy i w jakiej kolejności ma się pojawiać.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MiniStat
                icon={<Users className="h-4 w-4" />}
                label="Wszyscy"
                value={String(users.length)}
              />
              <MiniStat
                icon={<ShieldCheck className="h-4 w-4" />}
                label="Aktywni"
                value={String(users.filter((user) => user.active).length)}
              />
              <MiniStat
                icon={<UserPlus className="h-4 w-4" />}
                label="Grupy"
                value={String(TEAM_GROUPS.length)}
              />
              <MiniStat
                icon={<GripHorizontal className="h-4 w-4" />}
                label="Widok sterowany appką"
                value="ON"
              />
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

        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {groupedCounts.map((item) => (
            <div
              key={item.group}
              className="rounded-[24px] border border-white/10 bg-white/5 px-5 py-5"
            >
              <div
                className={clsx(
                  "mb-3 inline-flex rounded-xl border bg-white/5 p-2 ring-1 ring-inset",
                  groupClass(item.group),
                )}
              >
                <Users className="h-4 w-4" />
              </div>

              <div className="text-3xl font-semibold tracking-tight">
                {item.count}
              </div>
              <div className="mt-1 text-sm text-zinc-400">{item.group}</div>
            </div>
          ))}
        </div>

        <div className="mb-6 grid gap-6 xl:grid-cols-[420px_1fr]">
          <div className="rounded-[30px] border border-white/10 bg-white/[0.04] p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-2 text-zinc-300">
                <Plus className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Dodaj użytkownika</h2>
                <p className="text-sm text-zinc-400">
                  Użytkownik pojawi się w grafiku dopiero wtedy, gdy excelName
                  będzie zgodne z nagłówkiem z Excela.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <Field label="Imię">
                <input
                  value={form.firstName}
                  onChange={(e) => updateForm("firstName", e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
                  placeholder="Np. Kuba"
                />
              </Field>

              <Field label="Nazwisko">
                <input
                  value={form.lastName}
                  onChange={(e) => updateForm("lastName", e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
                  placeholder="Np. Kowalski"
                />
              </Field>

              <Field label="Nazwa w Excelu (excelName)">
                <input
                  value={form.excelName}
                  onChange={(e) => updateForm("excelName", e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
                  placeholder="Musi zgadzać się z kolumną z Excela"
                />
              </Field>

              <Field label="Grupa">
                <select
                  value={form.group}
                  onChange={(e) =>
                    updateForm("group", e.target.value as TeamGroup)
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
                >
                  {TEAM_GROUPS.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-white">Aktywny</div>
                  <div className="text-xs text-zinc-500">
                    Nieaktywny użytkownik nie pojawi się w grafiku.
                  </div>
                </div>

                <Toggle
                  checked={form.active}
                  onChange={(value) => updateForm("active", value)}
                />
              </div>

              <button
                type="button"
                onClick={handleCreate}
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                {saving ? "Dodawanie..." : "Dodaj użytkownika"}
              </button>
            </div>
          </div>

          <div className="rounded-[30px] border border-white/10 bg-white/[0.04] p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Lista użytkowników</h2>
                <p className="text-sm text-zinc-400">
                  Kolejność globalna steruje kolejnością kolumn w grafiku.
                </p>
              </div>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-12 text-center text-zinc-500">
                Wczytywanie użytkowników...
              </div>
            ) : !users.length ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-12 text-center text-zinc-500">
                Brak użytkowników.
              </div>
            ) : (
              <div className="space-y-3">
                {users.map((user) => (
                  <motion.div
                    key={user.id}
                    layout
                    transition={{ type: "spring", stiffness: 360, damping: 30 }}
                    className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4"
                  >
                    <div className="grid gap-4 xl:grid-cols-[1.4fr_140px_140px_150px_230px]">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-base font-semibold text-white">
                            {user.displayName}
                          </div>

                          <span
                            className={clsx(
                              "rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset",
                              groupClass(user.group),
                            )}
                          >
                            {user.group}
                          </span>

                          <span
                            className={clsx(
                              "rounded-full border px-3 py-1 text-xs font-medium",
                              user.active
                                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                                : "border-zinc-500/20 bg-zinc-500/10 text-zinc-400",
                            )}
                          >
                            {user.active ? "Aktywny" : "Nieaktywny"}
                          </span>
                        </div>

                        <div className="mt-2 grid gap-1 text-sm text-zinc-400">
                          <div>
                            Imię i nazwisko:{" "}
                            <span className="text-zinc-200">
                              {user.firstName} {user.lastName}
                            </span>
                          </div>
                          <div>
                            Excel:{" "}
                            <span className="text-zinc-200">
                              {user.excelName}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                          Grupa
                        </div>
                        <select
                          value={user.group}
                          onChange={(e) =>
                            handleQuickGroupChange(
                              user,
                              e.target.value as TeamGroup,
                            )
                          }
                          className="mt-2 w-full bg-transparent text-sm text-white outline-none"
                        >
                          {TEAM_GROUPS.map((group) => (
                            <option key={group} value={group}>
                              {group}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                          Aktywny
                        </div>
                        <div className="mt-3">
                          <Toggle
                            checked={user.active}
                            onChange={(value) =>
                              handleToggleActive(user, value)
                            }
                          />
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                          Kolejność
                        </div>
                        <div className="mt-2 space-y-1 text-sm text-zinc-300">
                          <div>Grupa: {user.groupOrder}</div>
                          <div>Zespół: {user.teamOrder}</div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                        <button
                          type="button"
                          onClick={() => setOrderUser(user)}
                          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                        >
                          <Shuffle className="h-4 w-4" />
                          Zmień kolejność
                        </button>

                        <button
                          type="button"
                          onClick={() => setEditingUser(user)}
                          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                        >
                          <Pencil className="h-4 w-4" />
                          Edytuj
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(user)}
                          className="inline-flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-200 transition hover:bg-red-500/15"
                        >
                          <Trash2 className="h-4 w-4" />
                          Usuń
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {editingUser ? (
          <motion.div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, y: 22, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 220, damping: 24 }}
              className="w-full max-w-2xl rounded-[30px] border border-white/10 bg-[#070709] p-6 shadow-[0_40px_160px_rgba(0,0,0,0.55)]"
            >
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    Edytuj użytkownika
                  </h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    Zmieniasz dane użytkownika sterującego widokiem grafiku.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                >
                  Zamknij
                </button>
              </div>

              <div className="space-y-4">
                <Field label="Imię">
                  <input
                    value={editingUser.firstName}
                    onChange={(e) =>
                      setEditingUser((prev) =>
                        prev ? { ...prev, firstName: e.target.value } : prev,
                      )
                    }
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
                  />
                </Field>

                <Field label="Nazwisko">
                  <input
                    value={editingUser.lastName}
                    onChange={(e) =>
                      setEditingUser((prev) =>
                        prev ? { ...prev, lastName: e.target.value } : prev,
                      )
                    }
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
                  />
                </Field>

                <Field label="excelName">
                  <input
                    value={editingUser.excelName}
                    onChange={(e) =>
                      setEditingUser((prev) =>
                        prev ? { ...prev, excelName: e.target.value } : prev,
                      )
                    }
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
                  />
                </Field>

                <Field label="Grupa">
                  <select
                    value={editingUser.group}
                    onChange={(e) =>
                      setEditingUser((prev) =>
                        prev
                          ? { ...prev, group: e.target.value as TeamGroup }
                          : prev,
                      )
                    }
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
                  >
                    {TEAM_GROUPS.map((group) => (
                      <option key={group} value={group}>
                        {group}
                      </option>
                    ))}
                  </select>
                </Field>

                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <div>
                    <div className="text-sm font-medium text-white">
                      Aktywny
                    </div>
                    <div className="text-xs text-zinc-500">
                      Możesz też szybko ukryć użytkownika bez usuwania.
                    </div>
                  </div>

                  <Toggle
                    checked={editingUser.active}
                    onChange={(value) =>
                      setEditingUser((prev) =>
                        prev ? { ...prev, active: value } : prev,
                      )
                    }
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Anuluj
                </button>

                <button
                  type="button"
                  onClick={handleEditSave}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {saving ? "Zapisywanie..." : "Zapisz zmiany"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {orderUser ? (
        <OrderModal
          user={orderUser}
          users={users}
          onClose={() => setOrderUser(null)}
          onSave={handleOrderSave}
          saving={orderSaving}
        />
      ) : null}
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4">
      <div className="mb-2 inline-flex rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-300">
        {icon}
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
