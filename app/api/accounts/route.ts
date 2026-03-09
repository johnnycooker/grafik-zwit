// app/api/accounts/route.ts

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth-permissions";
import { createAccount, listAccounts } from "@/lib/auth-accounts";
import { writeAuditLog } from "@/lib/auth-audit";
import type { AppPermission, AppRole } from "@/types/auth";

function isPermissionsArray(value: unknown): value is AppPermission[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function isValidRole(value: unknown): value is AppRole {
  return value === "admin" || value === "coordinator" || value === "employee";
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (
      !session?.user ||
      !hasPermission(session.user.permissions, "accounts.manage")
    ) {
      return NextResponse.json(
        { ok: false, error: "Brak uprawnień." },
        { status: 403 },
      );
    }

    const accounts = await listAccounts();

    return NextResponse.json({
      ok: true,
      accounts,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Nie udało się pobrać kont.",
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
      !hasPermission(session.user.permissions, "accounts.manage")
    ) {
      return NextResponse.json(
        { ok: false, error: "Brak uprawnień." },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => null);

    const username = body?.username;
    const password = body?.password;
    const role = body?.role;
    const permissions = body?.permissions;

    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      !isValidRole(role) ||
      !isPermissionsArray(permissions)
    ) {
      return NextResponse.json(
        { ok: false, error: "Nieprawidłowe dane konta." },
        { status: 400 },
      );
    }

    const accounts = await createAccount({
      username,
      password,
      role,
      permissions,
      createdBy: session.user.username,
    });

    await writeAuditLog({
      actorId: session.user.id,
      actorUsername: session.user.username,
      action: "accounts.create",
      category: "accounts",
      entityType: "account",
      entityLabel: username,
      targetName: username,
      status: "success",
      request,
      message: `Użytkownik ${session.user.username} utworzył konto ${role} dla loginu ${username}.`,
      meta: {
        role,
        permissions,
      },
    });

    return NextResponse.json({
      ok: true,
      accounts,
    });
  } catch (error) {
    await writeAuditLog({
      actorId: session?.user?.id ?? null,
      actorUsername: session?.user?.username ?? null,
      action: "accounts.create",
      category: "accounts",
      entityType: "account",
      status: "failure",
      request,
      message: `Nie udało się utworzyć konta.`,
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
            : "Nie udało się utworzyć konta.",
      },
      { status: 500 },
    );
  }
}
