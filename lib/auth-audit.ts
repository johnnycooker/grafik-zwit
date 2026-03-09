// lib/auth-audit.ts

import { randomUUID } from "crypto";
import { firestore } from "@/lib/firebase-admin";
import {
  getClientIp,
  getRequestRoute,
  getUserAgent,
} from "@/lib/request-context";
import type {
  AuditLogCategory,
  AuditLogRecord,
  AuditLogStatus,
} from "@/types/audit";

const COLLECTION_NAME = "audit_logs";

type RequestLike =
  | Request
  | Headers
  | {
      headers: Headers;
      nextUrl?: { pathname?: string };
      url?: string;
    }
  | null
  | undefined;

type WriteAuditLogInput = {
  actorId?: string | null;
  actorUsername?: string | null;
  action: string;
  category: AuditLogCategory;
  entityType: string;
  entityId?: string | null;
  entityLabel?: string | null;
  targetName?: string | null;
  route?: string | null;
  status?: AuditLogStatus;
  message: string;
  meta?: Record<string, unknown> | null;
  request?: RequestLike;
};

function collection() {
  return firestore.collection(COLLECTION_NAME);
}

function nowIso() {
  return new Date().toISOString();
}

function sanitizeMeta(meta: Record<string, unknown> | null | undefined) {
  if (!meta) return null;

  try {
    return JSON.parse(JSON.stringify(meta)) as Record<string, unknown>;
  } catch {
    return {
      info: "Nie udało się zserializować meta.",
    };
  }
}

export async function writeAuditLog(input: WriteAuditLogInput) {
  const payload: AuditLogRecord = {
    id: randomUUID(),
    actorId: input.actorId ?? null,
    actorUsername: input.actorUsername ?? null,
    action: input.action,
    category: input.category,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    entityLabel: input.entityLabel ?? null,
    targetName: input.targetName ?? null,
    route: input.route ?? getRequestRoute(input.request) ?? null,
    ip: getClientIp(input.request),
    userAgent: getUserAgent(input.request),
    message: input.message,
    status: input.status ?? "success",
    meta: sanitizeMeta(input.meta),
    createdAt: nowIso(),
  };

  await collection().doc(payload.id).set(payload);

  return payload;
}

export type ListAuditLogsInput = {
  limitCount?: number;
  status?: AuditLogStatus | "";
  action?: string;
  category?: AuditLogCategory | "";
  from?: string;
  to?: string;
};

export async function listAuditLogs(
  input: ListAuditLogsInput = {},
): Promise<AuditLogRecord[]> {
  const limitCount = input.limitCount ?? 1500;

  // Celowo pobieramy tylko po createdAt, bez dodatkowych where,
  // żeby nie wymagać composite indexów w Firestore.
  const snapshot = await collection()
    .orderBy("createdAt", "desc")
    .limit(limitCount)
    .get();

  let logs = snapshot.docs.map((doc) => doc.data() as AuditLogRecord);

  if (input.status) {
    logs = logs.filter((log) => log.status === input.status);
  }

  if (input.action) {
    logs = logs.filter((log) => log.action === input.action);
  }

  if (input.category) {
    logs = logs.filter((log) => log.category === input.category);
  }

  if (input.from) {
    const fromMs = new Date(input.from).getTime();
    if (!Number.isNaN(fromMs)) {
      logs = logs.filter((log) => {
        const createdAtMs = new Date(log.createdAt).getTime();
        return !Number.isNaN(createdAtMs) && createdAtMs >= fromMs;
      });
    }
  }

  if (input.to) {
    const toMs = new Date(input.to).getTime();
    if (!Number.isNaN(toMs)) {
      logs = logs.filter((log) => {
        const createdAtMs = new Date(log.createdAt).getTime();
        return !Number.isNaN(createdAtMs) && createdAtMs <= toMs;
      });
    }
  }

  return logs;
}
