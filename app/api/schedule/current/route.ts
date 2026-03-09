// app/api/schedule/current/route.ts

import { NextResponse } from "next/server";
import { getCurrentScheduleFromFirebase } from "@/lib/firebase-rtdb";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const current = await getCurrentScheduleFromFirebase();

    return NextResponse.json({
      ok: true,
      data: current?.data ?? null,
      meta: current
        ? {
            savedAt: current.savedAt,
            source: current.source,
            version: current.version,
          }
        : null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Nie udało się odczytać danych z Firebase.",
      },
      { status: 500 },
    );
  }
}
