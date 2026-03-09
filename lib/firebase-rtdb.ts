// lib/firebase-rtdb.ts

import type { ScheduleData } from "@/lib/parse-schedule";

const baseUrl = process.env.FIREBASE_RTDB_URL;

if (!baseUrl) {
  throw new Error("Brak FIREBASE_RTDB_URL w .env.local");
}

type ScheduleCacheRecord = {
  version: 1;
  source: "excel-import";
  savedAt: string;
  data: ScheduleData;
};

function buildUrl(path: string) {
  const normalizedBase = baseUrl!.replace(/\/+$/, "");
  const normalizedPath = path.replace(/^\/+/, "");
  return `${normalizedBase}/${normalizedPath}.json`;
}

async function firebaseFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Firebase RTDB error (${response.status}): ${text || "Brak treści odpowiedzi."}`,
    );
  }

  return response.json() as Promise<T>;
}

export async function saveCurrentScheduleToFirebase(data: ScheduleData) {
  const payload: ScheduleCacheRecord = {
    version: 1,
    source: "excel-import",
    savedAt: new Date().toISOString(),
    data,
  };

  await firebaseFetch("schedule/current", {
    method: "PUT",
    body: JSON.stringify(payload),
  });

  return payload;
}

export async function getCurrentScheduleFromFirebase(): Promise<ScheduleCacheRecord | null> {
  const result = await firebaseFetch<ScheduleCacheRecord | null>(
    "schedule/current",
    {
      method: "GET",
    },
  );

  return result;
}
