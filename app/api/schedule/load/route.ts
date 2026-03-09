import { NextRequest, NextResponse } from "next/server";
import { parseScheduleWorkbook } from "@/lib/parse-schedule";
import { encodeShareUrlForGraph } from "@/lib/share-url";
import { saveCurrentScheduleToFirebase } from "@/lib/firebase-rtdb";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth-permissions";
import { writeAuditLog } from "@/lib/auth-audit";

export const dynamic = "force-dynamic";

async function graphFetch(url: string, accessToken: string) {
  return fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "*/*",
    },
  });
}

function looksLikeXlsx(buffer: Buffer) {
  if (buffer.length < 4) return false;

  return (
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07)
  );
}

export async function POST(request: NextRequest) {
  const session = await auth();

  try {
    if (
      !session?.user ||
      !hasPermission(session.user.permissions, "schedule.load_excel")
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

    if (!accessToken || typeof accessToken !== "string") {
      return NextResponse.json(
        { ok: false, error: "Brak access tokenu." },
        { status: 401 },
      );
    }

    const encoded = encodeShareUrlForGraph(shareUrl);

    const itemResponse = await graphFetch(
      `https://graph.microsoft.com/v1.0/shares/${encoded}/driveItem`,
      accessToken,
    );

    if (!itemResponse.ok) {
      const text = await itemResponse.text();
      return NextResponse.json(
        {
          ok: false,
          error: "Nie udało się odczytać metadanych pliku z Microsoft Graph.",
          debug: {
            step: "driveItem",
            status: itemResponse.status,
            response: text,
          },
        },
        { status: itemResponse.status },
      );
    }

    const itemJson = await itemResponse.json();
    const contentUrl = itemJson?.["@microsoft.graph.downloadUrl"] as
      | string
      | undefined;

    if (contentUrl) {
      const fileResponse = await fetch(contentUrl, {
        method: "GET",
        cache: "no-store",
      });

      if (!fileResponse.ok) {
        return NextResponse.json(
          {
            ok: false,
            error: "Nie udało się pobrać pliku z downloadUrl.",
            debug: {
              step: "downloadUrl",
              status: fileResponse.status,
            },
          },
          { status: fileResponse.status },
        );
      }

      const fileBuffer = Buffer.from(await fileResponse.arrayBuffer());

      if (!looksLikeXlsx(fileBuffer)) {
        return NextResponse.json(
          {
            ok: false,
            error: "Pobrane dane nie wyglądają na plik XLSX.",
            debug: {
              step: "downloadUrl-validate",
            },
          },
          { status: 422 },
        );
      }

      const data = parseScheduleWorkbook(fileBuffer);
      const saved = await saveCurrentScheduleToFirebase(data);

      await writeAuditLog({
        actorId: session.user.id,
        actorUsername: session.user.username,
        action: "schedule.load_excel",
        category: "schedule",
        entityType: "schedule",
        entityLabel: data.meta.sheetName,
        targetName: data.meta.sheetName,
        status: "success",
        request,
        message: `Użytkownik ${session.user.username} zaczytał grafik z Excela.`,
        meta: {
          rows: data.rows.length,
          employees: data.employees.length,
        },
      });

      return NextResponse.json({
        ok: true,
        data,
        firebase: {
          savedAt: saved.savedAt,
          source: saved.source,
        },
      });
    }

    const contentResponse = await graphFetch(
      `https://graph.microsoft.com/v1.0/shares/${encoded}/driveItem/content`,
      accessToken,
    );

    if (!contentResponse.ok) {
      const text = await contentResponse.text();
      return NextResponse.json(
        {
          ok: false,
          error: "Nie udało się pobrać zawartości pliku z Microsoft Graph.",
          debug: {
            step: "content",
            status: contentResponse.status,
            response: text,
          },
        },
        { status: contentResponse.status },
      );
    }

    const fileBuffer = Buffer.from(await contentResponse.arrayBuffer());

    if (!looksLikeXlsx(fileBuffer)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Graph zwrócił dane, ale to nie wygląda na XLSX.",
        },
        { status: 422 },
      );
    }

    const data = parseScheduleWorkbook(fileBuffer);
    const saved = await saveCurrentScheduleToFirebase(data);

    await writeAuditLog({
      actorId: session.user.id,
      actorUsername: session.user.username,
      action: "schedule.load_excel",
      category: "schedule",
      entityType: "schedule",
      entityLabel: data.meta.sheetName,
      targetName: data.meta.sheetName,
      status: "success",
      request,
      message: `Użytkownik ${session.user.username} zaczytał grafik z Excela.`,
      meta: {
        rows: data.rows.length,
        employees: data.employees.length,
      },
    });

    return NextResponse.json({
      ok: true,
      data,
      firebase: {
        savedAt: saved.savedAt,
        source: saved.source,
      },
    });
  } catch (error) {
    await writeAuditLog({
      actorId: session?.user?.id ?? null,
      actorUsername: session?.user?.username ?? null,
      action: "schedule.load_excel",
      category: "schedule",
      entityType: "schedule",
      status: "failure",
      request,
      message: `Nie udało się zaczytać grafiku z Excela.`,
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
