// app/api/accounts/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth-permissions";
import { deleteAccount, updateAccount } from "@/lib/auth-accounts";
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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
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

    const { id } = await context.params;
    const body = await request.json().catch(() => null);

    const payload: {
      username?: string;
      role?: AppRole;
      permissions?: AppPermission[];
      isActive?: boolean;
    } = {};

    if (body?.username !== undefined) {
      if (typeof body.username !== "string") {
        return NextResponse.json(
          { ok: false, error: "Nieprawidłowy login." },
          { status: 400 },
        );
      }
      payload.username = body.username;
    }

    if (body?.role !== undefined) {
      if (!isValidRole(body.role)) {
        return NextResponse.json(
          { ok: false, error: "Nieprawidłowa rola." },
          { status: 400 },
        );
      }
      payload.role = body.role;
    }

    if (body?.permissions !== undefined) {
      if (!isPermissionsArray(body.permissions)) {
        return NextResponse.json(
          { ok: false, error: "Nieprawidłowe uprawnienia." },
          { status: 400 },
        );
      }
      payload.permissions = body.permissions;
    }

    if (body?.isActive !== undefined) {
      if (typeof body.isActive !== "boolean") {
        return NextResponse.json(
          { ok: false, error: "Nieprawidłowa wartość isActive." },
          { status: 400 },
        );
      }
      payload.isActive = body.isActive;
    }

    const accounts = await updateAccount(id, payload);

    await writeAuditLog({
      actorId: session.user.id,
      actorUsername: session.user.username,
      action: "accounts.update",
      category: "accounts",
      entityType: "account",
      entityId: id,
      entityLabel: payload.username ?? id,
      targetName: payload.username ?? id,
      status: "success",
      request,
      message: `Użytkownik ${session.user.username} zaktualizował konto ${payload.username ?? id}.`,
      meta: payload,
    });

    return NextResponse.json({
      ok: true,
      accounts,
    });
  } catch (error) {
    await writeAuditLog({
      actorId: session?.user?.id ?? null,
      actorUsername: session?.user?.username ?? null,
      action: "accounts.update",
      category: "accounts",
      entityType: "account",
      status: "failure",
      request,
      message: `Nie udało się zaktualizować konta.`,
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
            : "Nie udało się zaktualizować konta.",
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
      !hasPermission(session.user.permissions, "accounts.manage")
    ) {
      return NextResponse.json(
        { ok: false, error: "Brak uprawnień." },
        { status: 403 },
      );
    }

    const { id } = await context.params;
    const accounts = await deleteAccount(id);

    await writeAuditLog({
      actorId: session.user.id,
      actorUsername: session.user.username,
      action: "accounts.delete",
      category: "accounts",
      entityType: "account",
      entityId: id,
      entityLabel: id,
      targetName: id,
      status: "success",
      request,
      message: `Użytkownik ${session.user.username} usunął konto ${id}.`,
    });

    return NextResponse.json({
      ok: true,
      accounts,
    });
  } catch (error) {
    await writeAuditLog({
      actorId: session?.user?.id ?? null,
      actorUsername: session?.user?.username ?? null,
      action: "accounts.delete",
      category: "accounts",
      entityType: "account",
      status: "failure",
      request,
      message: `Nie udało się usunąć konta.`,
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
            : "Nie udało się usunąć konta.",
      },
      { status: 500 },
    );
  }
}
