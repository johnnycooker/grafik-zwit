import { NextRequest, NextResponse } from "next/server";
import type { ScheduleData } from "@/lib/parse-schedule";
import { encodeShareUrlForGraph } from "@/lib/share-url";
import { saveCurrentScheduleToFirebase } from "@/lib/firebase-rtdb";
import { applyScheduleDataToWorkbook } from "@/lib/update-schedule-workbook";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth-permissions";
import { writeAuditLog } from "@/lib/auth-audit";

export const dynamic = "force-dynamic";

type SharedDriveItemMeta = {
  id?: string;
  name?: string;
  parentReference?: {
    driveId?: string;
  };
};

function looksLikeXlsx(buffer: Buffer) {
  if (buffer.length < 4) return false;

  return (
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07)
  );
}

function isValidScheduleData(data: unknown): data is ScheduleData {
  if (!data || typeof data !== "object") return false;

  const candidate = data as ScheduleData;

  return (
    Array.isArray(candidate.employees) &&
    Array.isArray(candidate.rows) &&
    typeof candidate.meta === "object" &&
    candidate.meta !== null
  );
}

async function graphJsonFetch(
  url: string,
  accessToken: string,
  init?: RequestInit,
) {
  return fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

async function resolveSharedDriveItem(
  encodedShareUrl: string,
  accessToken: string,
): Promise<SharedDriveItemMeta> {
  const response = await graphJsonFetch(
    `https://graph.microsoft.com/v1.0/shares/${encodedShareUrl}/driveItem?$select=id,name,parentReference`,
    accessToken,
  );

  if (!response.ok) {
    throw new Error(
      "Plik Excel jest aktualnie otwarty w przeglądarce lub zablokowany przez OneDrive. Zamknij plik i spróbuj ponownie.",
    );
  }

  return (await response.json()) as SharedDriveItemMeta;
}

async function downloadWorkbookBuffer(
  driveId: string,
  itemId: string,
  accessToken: string,
) {
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/content`,
    {
      method: "GET",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "*/*",
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      "Plik Excel jest aktualnie otwarty w przeglądarce lub zablokowany przez OneDrive. Zamknij plik i spróbuj ponownie.",
    );
  }

  const fileBuffer = Buffer.from(await response.arrayBuffer());

  if (!looksLikeXlsx(fileBuffer)) {
    throw new Error("Pobrane dane nie wyglądają na plik XLSX.");
  }

  return fileBuffer;
}

async function uploadWorkbookBuffer(
  driveId: string,
  itemId: string,
  accessToken: string,
  fileBuffer: Buffer,
) {
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/content`,
    {
      method: "PUT",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
      body: new Uint8Array(fileBuffer),
    },
  );

  if (!response.ok) {
    throw new Error(
      "Plik Excel jest aktualnie otwarty w przeglądarce lub zablokowany przez OneDrive. Zamknij plik i spróbuj ponownie.",
    );
  }

  return response.json().catch(() => null);
}

export async function POST(request: NextRequest) {
  const session = await auth();

  try {
    if (
      !session?.user ||
      !hasPermission(session.user.permissions, "schedule.edit")
    ) {
      return NextResponse.json(
        { ok: false, error: "Brak uprawnień." },
        { status: 403 },
      );
    }

    const shareUrl = process.env.ONEDRIVE_EXCEL_SHARE_URL;

    if (!shareUrl) {
      return NextResponse.json(
        {
          ok: false,
          error: "Brak ONEDRIVE_EXCEL_SHARE_URL w .env.local",
        },
        { status: 500 },
      );
    }

    const body = await request.json().catch(() => null);
    const accessToken = body?.accessToken;
    const data = body?.data;

    if (!accessToken || typeof accessToken !== "string") {
      return NextResponse.json(
        { ok: false, error: "Brak access tokenu." },
        { status: 401 },
      );
    }

    if (!isValidScheduleData(data)) {
      return NextResponse.json(
        { ok: false, error: "Nieprawidłowe dane grafiku." },
        { status: 400 },
      );
    }

    const encoded = encodeShareUrlForGraph(shareUrl);
    const itemMeta = await resolveSharedDriveItem(encoded, accessToken);

    const itemId = itemMeta.id;
    const driveId = itemMeta.parentReference?.driveId;

    if (!itemId || !driveId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Nie udało się ustalić driveId lub itemId pliku.",
        },
        { status: 500 },
      );
    }

    const originalBuffer = await downloadWorkbookBuffer(
      driveId,
      itemId,
      accessToken,
    );

    const updated = await applyScheduleDataToWorkbook(originalBuffer, data);

    await uploadWorkbookBuffer(driveId, itemId, accessToken, updated.buffer);

    const saved = await saveCurrentScheduleToFirebase(data);

    await writeAuditLog({
      actorId: session.user.id,
      actorUsername: session.user.username,
      action: "schedule.save_excel",
      category: "schedule",
      entityType: "schedule",
      entityLabel: itemMeta.name ?? data.meta.sheetName,
      targetName: itemMeta.name ?? data.meta.sheetName,
      status: "success",
      request,
      message: `Użytkownik ${session.user.username} zapisał zmiany grafiku do Excela.`,
      meta: {
        changedCells: updated.summary.changedCells,
        missingEmployees: updated.summary.missingEmployees.length,
        missingDates: updated.summary.missingDates.length,
      },
    });

    return NextResponse.json({
      ok: true,
      data,
      firebase: {
        savedAt: saved.savedAt,
        source: saved.source,
      },
      workbook: {
        fileName: itemMeta.name ?? null,
        changedCells: updated.summary.changedCells,
        missingEmployees: updated.summary.missingEmployees,
        missingDates: updated.summary.missingDates,
        sheetName: updated.summary.sheetName,
      },
    });
  } catch (error) {
    await writeAuditLog({
      actorId: session?.user?.id ?? null,
      actorUsername: session?.user?.username ?? null,
      action: "schedule.save_excel",
      category: "schedule",
      entityType: "schedule",
      status: "failure",
      request,
      message: `Nie udało się zapisać zmian grafiku do Excela.`,
      meta: {
        error:
          error instanceof Error ? error.message : "Nieznany błąd serwera.",
      },
    });

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Nieznany błąd serwera.",
      },
      { status: 500 },
    );
  }
}
