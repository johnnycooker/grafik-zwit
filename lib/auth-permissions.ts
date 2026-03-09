// lib/auth-permissions.ts

import type { AppPermission, AppRole } from "@/types/auth";

export const ALL_PERMISSIONS: AppPermission[] = [
  "schedule.read",
  "schedule.edit",
  "schedule.load_excel",
  "employees.manage",
  "accounts.manage",
  "logs.read",
];

export function getDefaultPermissionsForRole(role: AppRole): AppPermission[] {
  switch (role) {
    case "admin":
      return [...ALL_PERMISSIONS];
    case "employee":
      return ["schedule.read"];
    case "coordinator":
      return ["schedule.read"];
    default:
      return [];
  }
}

export function hasPermission(
  permissions: AppPermission[] | undefined,
  permission: AppPermission,
) {
  if (!permissions) return false;
  return permissions.includes(permission);
}
