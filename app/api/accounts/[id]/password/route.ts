// app/api/accounts/[id]/password/route.ts

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth-permissions";
import { changeAccountPassword } from "@/lib/auth-accounts";
import { writeAuditLog } from "@/lib/auth-audit";

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
    const password = body?.password;

    if (typeof password !== "string") {
      return NextResponse.json(
        { ok: false, error: "Nieprawidłowe hasło." },
        { status: 400 },
      );
    }

    const accounts = await changeAccountPassword(id, password);

    await writeAuditLog({
      actorId: session.user.id,
      actorUsername: session.user.username,
      action: "accounts.change_password",
      category: "accounts",
      entityType: "account",
      entityId: id,
      entityLabel: id,
      targetName: id,
      status: "success",
      request,
      message: `Użytkownik ${session.user.username} zmienił hasło konta ${id}.`,
    });

    return NextResponse.json({
      ok: true,
      accounts,
    });
  } catch (error) {
    await writeAuditLog({
      actorId: session?.user?.id ?? null,
      actorUsername: session?.user?.username ?? null,
      action: "accounts.change_password",
      category: "accounts",
      entityType: "account",
      status: "failure",
      request,
      message: `Nie udało się zmienić hasła konta.`,
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
            : "Nie udało się zmienić hasła.",
      },
      { status: 500 },
    );
  }
}
