// app/api/users/reorder/route.ts

import { NextRequest, NextResponse } from "next/server";
import { reorderScheduleUserInFirebase } from "@/lib/schedule-users";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    const id = body?.id;
    const teamOrder = body?.teamOrder;
    const groupOrder = body?.groupOrder;

    if (
      typeof id !== "string" ||
      typeof teamOrder !== "number" ||
      typeof groupOrder !== "number"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Nieprawidłowe dane do zmiany kolejności.",
        },
        { status: 400 },
      );
    }

    const users = await reorderScheduleUserInFirebase({
      id,
      teamOrder,
      groupOrder,
    });

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
            : "Nie udało się zmienić kolejności.",
      },
      { status: 500 },
    );
  }
}
