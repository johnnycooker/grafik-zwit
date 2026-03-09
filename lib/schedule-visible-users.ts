// lib/schedule-visible-users.ts

import type { ScheduleData } from "@/lib/parse-schedule";
import type { ScheduleUser } from "@/lib/schedule-users.shared";

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("pl-PL");
}

export function resolveVisibleUsers(
  data: ScheduleData | null,
  users: ScheduleUser[],
) {
  if (!data) return [];

  const excelSet = new Set(
    data.employees.map((employee) => normalizeText(employee)),
  );

  return users
    .map((user) => ({
      ...user,
      excelMatched: excelSet.has(normalizeText(user.excelName)),
    }))
    .filter((user) => user.active && user.excelMatched)
    .sort((a, b) => a.teamOrder - b.teamOrder);
}
