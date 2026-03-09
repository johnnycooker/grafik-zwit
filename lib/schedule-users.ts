// lib/schedule-users.ts

import { randomUUID } from "crypto";
import {
  TEAM_GROUPS,
  type ScheduleUser,
  type ScheduleUserRecord,
  type TeamGroup,
} from "@/lib/schedule-users.shared";

const baseUrl = process.env.FIREBASE_RTDB_URL;

if (!baseUrl) {
  throw new Error("Brak FIREBASE_RTDB_URL w .env.local");
}

type ScheduleUsersMap = Record<string, ScheduleUserRecord>;

type CreateScheduleUserInput = {
  firstName: string;
  lastName: string;
  excelName: string;
  active: boolean;
  group: TeamGroup;
};

type UpdateScheduleUserInput = {
  firstName?: string;
  lastName?: string;
  excelName?: string;
  active?: boolean;
  group?: TeamGroup;
};

type ReorderScheduleUserInput = {
  id: string;
  teamOrder: number;
  groupOrder: number;
};

function buildUrl(path: string) {
  const normalizedBase = baseUrl!.replace(/\/+$/, "");
  const normalizedPath = path.replace(/^\/+/, "");
  return `${normalizedBase}/${normalizedPath}.json`;
}

async function firebaseFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Firebase RTDB error (${response.status}): ${text || "Brak treści odpowiedzi."}`,
    );
  }

  return response.json() as Promise<T>;
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizedKey(value: string) {
  return normalizeText(value).toLocaleLowerCase("pl-PL");
}

function sortUsers(users: ScheduleUserRecord[]) {
  return [...users].sort((a, b) => {
    if (a.teamOrder !== b.teamOrder) {
      return a.teamOrder - b.teamOrder;
    }

    if (a.group !== b.group) {
      return a.group.localeCompare(b.group, "pl");
    }

    if (a.groupOrder !== b.groupOrder) {
      return a.groupOrder - b.groupOrder;
    }

    return `${a.lastName} ${a.firstName}`.localeCompare(
      `${b.lastName} ${b.firstName}`,
      "pl",
    );
  });
}

function normalizeOrders(users: ScheduleUserRecord[]) {
  const sortedByTeam = sortUsers(users).map((user, index) => ({
    ...user,
    teamOrder: index + 1,
  }));

  for (const group of TEAM_GROUPS) {
    const groupUsers = sortedByTeam
      .filter((user) => user.group === group)
      .sort((a, b) => {
        if (a.groupOrder !== b.groupOrder) {
          return a.groupOrder - b.groupOrder;
        }
        return a.teamOrder - b.teamOrder;
      });

    groupUsers.forEach((user, index) => {
      const target = sortedByTeam.find((item) => item.id === user.id);
      if (target) {
        target.groupOrder = index + 1;
      }
    });
  }

  return sortedByTeam;
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const copy = [...items];
  const [moved] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, moved);
  return copy;
}

function buildDisplayNames(users: ScheduleUserRecord[]) {
  const byLastName = new Map<string, ScheduleUserRecord[]>();

  for (const user of users) {
    const key = normalizedKey(user.lastName);
    const list = byLastName.get(key) ?? [];
    list.push(user);
    byLastName.set(key, list);
  }

  const displayMap = new Map<string, string>();

  for (const group of byLastName.values()) {
    if (group.length === 1) {
      const only = group[0];
      displayMap.set(only.id, only.lastName);
      continue;
    }

    const byInitial = new Map<string, ScheduleUserRecord[]>();

    for (const user of group) {
      const initial = user.firstName
        .trim()
        .charAt(0)
        .toLocaleUpperCase("pl-PL");
      const list = byInitial.get(initial) ?? [];
      list.push(user);
      byInitial.set(initial, list);
    }

    for (const sameInitialUsers of byInitial.values()) {
      if (sameInitialUsers.length === 1) {
        const only = sameInitialUsers[0];
        const initial = only.firstName
          .trim()
          .charAt(0)
          .toLocaleUpperCase("pl-PL");
        displayMap.set(only.id, `${initial}. ${only.lastName}`);
        continue;
      }

      const byFullName = new Map<string, ScheduleUserRecord[]>();

      for (const user of sameInitialUsers) {
        const key = normalizedKey(`${user.firstName} ${user.lastName}`);
        const list = byFullName.get(key) ?? [];
        list.push(user);
        byFullName.set(key, list);
      }

      for (const sameFullNameUsers of byFullName.values()) {
        if (sameFullNameUsers.length === 1) {
          const only = sameFullNameUsers[0];
          displayMap.set(only.id, `${only.firstName} ${only.lastName}`);
          continue;
        }

        sameFullNameUsers.forEach((user, index) => {
          displayMap.set(
            user.id,
            `${user.firstName} ${user.lastName} ${index + 1}`,
          );
        });
      }
    }
  }

  return displayMap;
}

function enrichUsers(users: ScheduleUserRecord[]): ScheduleUser[] {
  const sorted = normalizeOrders(users);
  const displayMap = buildDisplayNames(sorted);

  return sorted.map((user) => ({
    ...user,
    displayName:
      displayMap.get(user.id) ?? `${user.firstName} ${user.lastName}`,
  }));
}

async function getUsersMapFromFirebase(): Promise<ScheduleUsersMap> {
  const result = await firebaseFetch<ScheduleUsersMap | null>(
    "schedule/users",
    {
      method: "GET",
    },
  );

  return result ?? {};
}

async function writeUsersMapToFirebase(map: ScheduleUsersMap) {
  await firebaseFetch("schedule/users", {
    method: "PUT",
    body: JSON.stringify(map),
  });
}

function ensureUniqueExcelName(
  users: ScheduleUserRecord[],
  excelName: string,
  excludeId?: string,
) {
  const normalized = normalizedKey(excelName);

  const duplicate = users.find(
    (user) =>
      user.id !== excludeId && normalizedKey(user.excelName) === normalized,
  );

  if (duplicate) {
    throw new Error("Użytkownik z taką nazwą excelName już istnieje.");
  }
}

export async function listScheduleUsersFromFirebase(): Promise<ScheduleUser[]> {
  const map = await getUsersMapFromFirebase();
  const users = Object.values(map);
  return enrichUsers(users);
}

export async function createScheduleUserInFirebase(
  input: CreateScheduleUserInput,
): Promise<ScheduleUser[]> {
  const map = await getUsersMapFromFirebase();
  const users = Object.values(map);

  const firstName = normalizeText(input.firstName);
  const lastName = normalizeText(input.lastName);
  const excelName = normalizeText(input.excelName);

  if (!firstName || !lastName || !excelName) {
    throw new Error("Imię, nazwisko i excelName są wymagane.");
  }

  ensureUniqueExcelName(users, excelName);

  const now = new Date().toISOString();

  const nextGroupOrder =
    users.filter((user) => user.group === input.group).length + 1;
  const nextTeamOrder = users.length + 1;

  const record: ScheduleUserRecord = {
    id: randomUUID(),
    firstName,
    lastName,
    excelName,
    active: input.active,
    group: input.group,
    groupOrder: nextGroupOrder,
    teamOrder: nextTeamOrder,
    createdAt: now,
    updatedAt: now,
  };

  const nextUsers = normalizeOrders([...users, record]);
  const nextMap = Object.fromEntries(nextUsers.map((user) => [user.id, user]));

  await writeUsersMapToFirebase(nextMap);

  return enrichUsers(nextUsers);
}

export async function updateScheduleUserInFirebase(
  id: string,
  input: UpdateScheduleUserInput,
): Promise<ScheduleUser[]> {
  const map = await getUsersMapFromFirebase();
  const users = Object.values(map);
  const target = users.find((user) => user.id === id);

  if (!target) {
    throw new Error("Nie znaleziono użytkownika.");
  }

  const nextFirstName =
    input.firstName !== undefined
      ? normalizeText(input.firstName)
      : target.firstName;
  const nextLastName =
    input.lastName !== undefined
      ? normalizeText(input.lastName)
      : target.lastName;
  const nextExcelName =
    input.excelName !== undefined
      ? normalizeText(input.excelName)
      : target.excelName;
  const nextGroup = input.group ?? target.group;

  if (!nextFirstName || !nextLastName || !nextExcelName) {
    throw new Error("Imię, nazwisko i excelName są wymagane.");
  }

  ensureUniqueExcelName(users, nextExcelName, id);

  const updatedAt = new Date().toISOString();

  let nextUsers = users.map((user) =>
    user.id === id
      ? {
          ...user,
          firstName: nextFirstName,
          lastName: nextLastName,
          excelName: nextExcelName,
          active: input.active ?? user.active,
          group: nextGroup,
          updatedAt,
        }
      : user,
  );

  const originalGroup = target.group;

  if (originalGroup !== nextGroup) {
    const sameGroupUsers = nextUsers
      .filter((user) => user.group === nextGroup && user.id !== id)
      .sort((a, b) => a.groupOrder - b.groupOrder);

    nextUsers = nextUsers.map((user) =>
      user.id === id
        ? {
            ...user,
            groupOrder: sameGroupUsers.length + 1,
          }
        : user,
    );
  }

  nextUsers = normalizeOrders(nextUsers);

  const nextMap = Object.fromEntries(nextUsers.map((user) => [user.id, user]));
  await writeUsersMapToFirebase(nextMap);

  return enrichUsers(nextUsers);
}

export async function deleteScheduleUserFromFirebase(
  id: string,
): Promise<ScheduleUser[]> {
  const map = await getUsersMapFromFirebase();
  const users = Object.values(map);

  const exists = users.some((user) => user.id === id);

  if (!exists) {
    throw new Error("Nie znaleziono użytkownika.");
  }

  const nextUsers = normalizeOrders(users.filter((user) => user.id !== id));
  const nextMap = Object.fromEntries(nextUsers.map((user) => [user.id, user]));

  await writeUsersMapToFirebase(nextMap);

  return enrichUsers(nextUsers);
}

export async function reorderScheduleUserInFirebase(
  input: ReorderScheduleUserInput,
): Promise<ScheduleUser[]> {
  const map = await getUsersMapFromFirebase();
  const users = Object.values(map);

  const target = users.find((user) => user.id === input.id);

  if (!target) {
    throw new Error("Nie znaleziono użytkownika.");
  }

  const safeTeamOrder = Math.max(1, Math.floor(input.teamOrder));
  const safeGroupOrder = Math.max(1, Math.floor(input.groupOrder));

  const withoutTarget = users.filter((user) => user.id !== target.id);

  const teamSorted = sortUsers(withoutTarget);
  const teamInsertIndex = Math.min(safeTeamOrder - 1, teamSorted.length);

  const reorderedTeam = [
    ...teamSorted.slice(0, teamInsertIndex),
    target,
    ...teamSorted.slice(teamInsertIndex),
  ].map((user, index) => ({
    ...user,
    teamOrder: index + 1,
  }));

  const nextUsers = [...reorderedTeam];

  const groupUsers = nextUsers
    .filter((user) => user.group === target.group)
    .sort((a, b) => {
      if (a.groupOrder !== b.groupOrder) {
        return a.groupOrder - b.groupOrder;
      }
      return a.teamOrder - b.teamOrder;
    });

  const currentGroupIndex = groupUsers.findIndex(
    (user) => user.id === target.id,
  );
  const nextGroupIndex = Math.min(safeGroupOrder - 1, groupUsers.length - 1);
  const movedGroupUsers = moveItem(
    groupUsers,
    currentGroupIndex,
    nextGroupIndex,
  );

  movedGroupUsers.forEach((groupUser, index) => {
    const targetUser = nextUsers.find((user) => user.id === groupUser.id);
    if (targetUser) {
      targetUser.groupOrder = index + 1;
    }
  });

  const normalized = normalizeOrders(nextUsers);
  const nextMap = Object.fromEntries(normalized.map((user) => [user.id, user]));

  await writeUsersMapToFirebase(nextMap);

  return enrichUsers(normalized);
}
