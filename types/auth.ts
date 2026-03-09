// types/auth.ts

export const APP_ROLES = ["admin", "coordinator", "employee"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const APP_PERMISSIONS = [
  "schedule.read",
  "schedule.edit",
  "schedule.load_excel",
  "employees.manage",
  "accounts.manage",
  "logs.read",
] as const;

export type AppPermission = (typeof APP_PERMISSIONS)[number];

export type SessionUserPayload = {
  id: string;
  username: string;
  role: AppRole;
  permissions: AppPermission[];
  isSystem: boolean;
};

export type AppAccountRecord = {
  id: string;
  username: string;
  passwordHash: string;
  role: AppRole;
  permissions: AppPermission[];
  isActive: boolean;
  isSystem: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
  passwordChangedAt?: string;
  createdBy?: string;
  lastLoginAt?: string;
};

export type AppAccount = Omit<AppAccountRecord, "passwordHash">;
