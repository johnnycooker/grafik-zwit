// app/api/logs/route.ts

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth-permissions";
import { listAuditLogs } from "@/lib/auth-audit";
import type { AuditLogCategory, AuditLogStatus } from "@/types/audit";

export const dynamic = "force-dynamic";

function normalizeDateTimeLocalToIso(value: string | null) {
  if (!value) return undefined;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;

  return parsed.toISOString();
}

function isValidStatus(value: string | null): value is AuditLogStatus {
  return value === "success" || value === "failure";
}

function isValidCategory(value: string | null): value is AuditLogCategory {
  return (
    value === "auth" ||
    value === "navigation" ||
    value === "accounts" ||
    value === "employees" ||
    value === "schedule" ||
    value === "system"
  );
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (
      !session?.user ||
      !hasPermission(session.user.permissions, "logs.read")
    ) {
      return NextResponse.json(
        { ok: false, error: "Brak uprawnień." },
        { status: 403 },
      );
    }

    const searchParams = request.nextUrl.searchParams;

    const status = searchParams.get("status");
    const action = searchParams.get("action");
    const category = searchParams.get("category");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const search = searchParams.get("search")?.trim().toLowerCase() ?? "";

    const logs = await listAuditLogs({
      limitCount: 500,
      status: isValidStatus(status) ? status : "",
      action: action || "",
      category: isValidCategory(category) ? category : "",
      from: normalizeDateTimeLocalToIso(from),
      to: normalizeDateTimeLocalToIso(to),
    });

    const filteredLogs = search
      ? logs.filter((log) => {
          return (
            (log.actorUsername ?? "").toLowerCase().includes(search) ||
            log.message.toLowerCase().includes(search) ||
            log.action.toLowerCase().includes(search) ||
            log.category.toLowerCase().includes(search) ||
            (log.entityLabel ?? "").toLowerCase().includes(search) ||
            (log.targetName ?? "").toLowerCase().includes(search) ||
            (log.route ?? "").toLowerCase().includes(search) ||
            (log.ip ?? "").toLowerCase().includes(search)
          );
        })
      : logs;

    return NextResponse.json({
      ok: true,
      logs: filteredLogs,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Nie udało się pobrać logów.",
      },
      { status: 500 },
    );
  }
}
