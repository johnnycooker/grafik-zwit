// app/api/logs/event/route.ts

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/auth-audit";

export const dynamic = "force-dynamic";

const ALLOWED_ACTIONS = ["navigation.enter", "auth.logout"] as const;

type AllowedAction = (typeof ALLOWED_ACTIONS)[number];

function isAllowedAction(value: unknown): value is AllowedAction {
  return (
    typeof value === "string" &&
    ALLOWED_ACTIONS.includes(value as AllowedAction)
  );
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { ok: false, error: "Brak sesji." },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => null);

    const action = body?.action;
    const route = body?.route;
    const pageLabel = body?.pageLabel;

    if (!isAllowedAction(action) || typeof route !== "string") {
      return NextResponse.json(
        { ok: false, error: "Nieprawidłowe dane loga." },
        { status: 400 },
      );
    }

    if (action === "navigation.enter") {
      await writeAuditLog({
        actorId: session.user.id,
        actorUsername: session.user.username,
        action,
        category: "navigation",
        entityType: "page",
        entityLabel: route,
        targetName: typeof pageLabel === "string" ? pageLabel : route,
        route,
        status: "success",
        message: `Użytkownik ${session.user.username} wszedł na stronę ${typeof pageLabel === "string" ? pageLabel : route}.`,
        request,
        meta: {
          pageLabel: typeof pageLabel === "string" ? pageLabel : route,
        },
      });
    }

    if (action === "auth.logout") {
      await writeAuditLog({
        actorId: session.user.id,
        actorUsername: session.user.username,
        action,
        category: "auth",
        entityType: "account",
        entityId: session.user.id,
        entityLabel: session.user.username,
        targetName: session.user.username,
        route,
        status: "success",
        message: `Użytkownik ${session.user.username} wylogował się z aplikacji.`,
        request,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Nie udało się zapisać loga.",
      },
      { status: 500 },
    );
  }
}
