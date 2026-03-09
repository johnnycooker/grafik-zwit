// types/audit.ts

export type AuditLogStatus = "success" | "failure";

export type AuditLogCategory =
  | "auth"
  | "navigation"
  | "accounts"
  | "employees"
  | "schedule"
  | "system";

export type AuditLogRecord = {
  id: string;
  actorId: string | null;
  actorUsername: string | null;
  action: string;
  category: AuditLogCategory;
  entityType: string;
  entityId?: string | null;
  entityLabel?: string | null;
  targetName?: string | null;
  route?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  message: string;
  status: AuditLogStatus;
  meta?: Record<string, unknown> | null;
  createdAt: string;
};
