// app/api/users/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import {
  deleteScheduleUserFromFirebase,
  updateScheduleUserInFirebase,
} from "@/lib/schedule-users";
import { TEAM_GROUPS, type TeamGroup } from "@/lib/schedule-users.shared";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth-permissions";
import { writeAuditLog } from "@/lib/auth-audit";

export const dynamic = "force-dynamic";

function isValidGroup(value: unknown): value is TeamGroup {
  return typeof value === "string" && TEAM_GROUPS.includes(value as TeamGroup);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  try {
    if (
      !session?.user ||
      !hasPermission(session.user.permissions, "employees.manage")
    ) {
      return NextResponse.json(
        { ok: false, error: "Brak uprawnień." },
        { status: 403 },
      );
    }

    const { id } = await context.params;
    const body = await request.json().catch(() => null);

    const payload: {
      firstName?: string;
      lastName?: string;
      excelName?: string;
      active?: boolean;
      group?: TeamGroup;
    } = {};

    if (body?.firstName !== undefined) {
      if (typeof body.firstName !== "string") {
        return NextResponse.json(
          { ok: false, error: "Nieprawidłowe firstName." },
          { status: 400 },
        );
      }
      payload.firstName = body.firstName;
    }

    if (body?.lastName !== undefined) {
      if (typeof body.lastName !== "string") {
        return NextResponse.json(
          { ok: false, error: "Nieprawidłowe lastName." },
          { status: 400 },
        );
      }
      payload.lastName = body.lastName;
    }

    if (body?.excelName !== undefined) {
      if (typeof body.excelName !== "string") {
        return NextResponse.json(
          { ok: false, error: "Nieprawidłowe excelName." },
          { status: 400 },
        );
      }
      payload.excelName = body.excelName;
    }

    if (body?.active !== undefined) {
      if (typeof body.active !== "boolean") {
        return NextResponse.json(
          { ok: false, error: "Nieprawidłowe active." },
          { status: 400 },
        );
      }
      payload.active = body.active;
    }

    if (body?.group !== undefined) {
      if (!isValidGroup(body.group)) {
        return NextResponse.json(
          { ok: false, error: "Nieprawidłowa grupa." },
          { status: 400 },
        );
      }
      payload.group = body.group;
    }

    const users = await updateScheduleUserInFirebase(id, payload);

    await writeAuditLog({
      actorId: session.user.id,
      actorUsername: session.user.username,
      action: "employees.update",
      category: "employees",
      entityType: "employee",
      entityId: id,
      entityLabel: payload.excelName ?? id,
      targetName:
        [payload.firstName, payload.lastName].filter(Boolean).join(" ") ||
        payload.excelName ||
        id,
      status: "success",
      request,
      message: `Użytkownik ${session.user.username} zaktualizował pracownika ${[payload.firstName, payload.lastName].filter(Boolean).join(" ") || payload.excelName || id}.`,
      meta: payload,
    });

    return NextResponse.json({
      ok: true,
      users,
    });
  } catch (error) {
    await writeAuditLog({
      actorId: session?.user?.id ?? null,
      actorUsername: session?.user?.username ?? null,
      action: "employees.update",
      category: "employees",
      entityType: "employee",
      status: "failure",
      request,
      message: `Nie udało się zaktualizować pracownika.`,
      meta: {
        error: error instanceof Error ? error.message : "Nieznany błąd.",
      },
    });

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Nie udało się zaktualizować użytkownika.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  try {
    if (
      !session?.user ||
      !hasPermission(session.user.permissions, "employees.manage")
    ) {
      return NextResponse.json(
        { ok: false, error: "Brak uprawnień." },
        { status: 403 },
      );
    }

    const { id } = await context.params;
    const users = await deleteScheduleUserFromFirebase(id);

    await writeAuditLog({
      actorId: session.user.id,
      actorUsername: session.user.username,
      action: "employees.delete",
      category: "employees",
      entityType: "employee",
      entityId: id,
      entityLabel: id,
      targetName: id,
      status: "success",
      request,
      message: `Użytkownik ${session.user.username} usunął pracownika ${id}.`,
    });

    return NextResponse.json({
      ok: true,
      users,
    });
  } catch (error) {
    await writeAuditLog({
      actorId: session?.user?.id ?? null,
      actorUsername: session?.user?.username ?? null,
      action: "employees.delete",
      category: "employees",
      entityType: "employee",
      status: "failure",
      request,
      message: `Nie udało się usunąć pracownika.`,
      meta: {
        error: error instanceof Error ? error.message : "Nieznany błąd.",
      },
    });

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Nie udało się usunąć użytkownika.",
      },
      { status: 500 },
    );
  }
}
