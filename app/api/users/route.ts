// app/api/users/route.ts

import { NextRequest, NextResponse } from "next/server";
import {
  createScheduleUserInFirebase,
  listScheduleUsersFromFirebase,
} from "@/lib/schedule-users";
import { TEAM_GROUPS, type TeamGroup } from "@/lib/schedule-users.shared";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth-permissions";
import { writeAuditLog } from "@/lib/auth-audit";

export const dynamic = "force-dynamic";

function isValidGroup(value: unknown): value is TeamGroup {
  return typeof value === "string" && TEAM_GROUPS.includes(value as TeamGroup);
}

export async function GET() {
  try {
    const session = await auth();

    if (
      !session?.user ||
      !hasPermission(session.user.permissions, "schedule.read")
    ) {
      return NextResponse.json(
        { ok: false, error: "Brak uprawnień." },
        { status: 403 },
      );
    }

    const users = await listScheduleUsersFromFirebase();

    return NextResponse.json({
      ok: true,
      users,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Nie udało się pobrać użytkowników.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();

  try {
    if (
      !session?.user ||
      !hasPermission(session.user.permissions, "employees.manage")
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Brak uprawnień.",
        },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => null);

    const firstName = body?.firstName;
    const lastName = body?.lastName;
    const excelName = body?.excelName;
    const active = Boolean(body?.active);
    const group = body?.group;

    if (
      typeof firstName !== "string" ||
      typeof lastName !== "string" ||
      typeof excelName !== "string" ||
      !isValidGroup(group)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Nieprawidłowe dane użytkownika.",
        },
        { status: 400 },
      );
    }

    const users = await createScheduleUserInFirebase({
      firstName,
      lastName,
      excelName,
      active,
      group,
    });

    await writeAuditLog({
      actorId: session.user.id,
      actorUsername: session.user.username,
      action: "employees.create",
      category: "employees",
      entityType: "employee",
      entityLabel: `${firstName} ${lastName}`,
      targetName: `${firstName} ${lastName}`,
      status: "success",
      request,
      message: `Użytkownik ${session.user.username} dodał pracownika ${firstName} ${lastName}.`,
      meta: {
        excelName,
        active,
        group,
      },
    });

    return NextResponse.json({
      ok: true,
      users,
    });
  } catch (error) {
    await writeAuditLog({
      actorId: session?.user?.id ?? null,
      actorUsername: session?.user?.username ?? null,
      action: "employees.create",
      category: "employees",
      entityType: "employee",
      status: "failure",
      request,
      message: `Nie udało się dodać pracownika.`,
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
            : "Nie udało się dodać użytkownika.",
      },
      { status: 500 },
    );
  }
}
