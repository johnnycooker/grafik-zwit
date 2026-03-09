// lib/parse-schedule.ts

import * as XLSX from "xlsx";

export type ScheduleRow = {
  date: string;
  employees: Record<string, string>;
};

export type ScheduleData = {
  employees: string[];
  rows: ScheduleRow[];
  meta: {
    sheetName: string;
    loadedAt: string;
    source: string;
  };
};

function normalizeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      const year = parsed.y;
      const month = String(parsed.m).padStart(2, "0");
      const day = String(parsed.d).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  }

  const text = normalizeCell(value);
  if (!text) return "";

  const direct = new Date(text);
  if (!Number.isNaN(direct.getTime())) {
    return direct.toISOString().slice(0, 10);
  }

  return text;
}

export function parseScheduleWorkbook(buffer: Buffer): ScheduleData {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
    raw: true,
  });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("Workbook nie zawiera żadnego arkusza.");
  }

  const sheet = workbook.Sheets[sheetName];

  const rawRows = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(
    sheet,
    {
      header: 1,
      raw: true,
      defval: "",
      blankrows: false,
    },
  );

  if (!rawRows.length) {
    throw new Error("Arkusz jest pusty.");
  }

  const headerRow = rawRows[0].map(normalizeCell);
  const firstCell = headerRow[0]?.toLowerCase();

  const hasDateColumn =
    firstCell === "data" || firstCell === "date" || firstCell.includes("data");

  const employees = (hasDateColumn ? headerRow.slice(1) : headerRow)
    .map((v) => v.trim())
    .filter(Boolean);

  const rows: ScheduleRow[] = rawRows
    .slice(1)
    .filter((row) => row.some((cell) => normalizeCell(cell) !== ""))
    .map((row, index) => {
      const date = hasDateColumn
        ? normalizeDate(row[0])
        : `Wiersz ${index + 2}`;
      const values = hasDateColumn ? row.slice(1) : row;

      const employeesMap: Record<string, string> = {};

      employees.forEach((employee, employeeIndex) => {
        employeesMap[employee] = normalizeCell(values[employeeIndex]);
      });

      return {
        date,
        employees: employeesMap,
      };
    });

  return {
    employees,
    rows,
    meta: {
      sheetName,
      loadedAt: new Date().toISOString(),
      source: "microsoft-graph",
    },
  };
}
