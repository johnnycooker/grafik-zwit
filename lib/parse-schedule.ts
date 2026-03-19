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
    loadedUntil?: string | null;
  };
};

type ParseScheduleWorkbookOptions = {
  maxDate?: string;
};

type EmployeeColumn = {
  name: string;
  columnIndex: number;
};

const MIN_SCHEDULE_DATE = "2026-01-01";

function normalizeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function pad2(value: number | string) {
  return String(value).padStart(2, "0");
}

function toIsoDate(year: number, month: number, day: number) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function parsePolishLikeDateText(text: string): string {
  const normalized = text.trim();

  if (!normalized) return "";

  const isoMatch = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return toIsoDate(Number(year), Number(month), Number(day));
  }

  const dmyMatch = normalized.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    return toIsoDate(Number(year), Number(month), Number(day));
  }

  return "";
}

function normalizeDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return toIsoDate(parsed.y, parsed.m, parsed.d);
    }
  }

  const text = normalizeCell(value);
  if (!text) return "";

  const parsedFromText = parsePolishLikeDateText(text);
  if (parsedFromText) {
    return parsedFromText;
  }

  return "";
}

function findDutyColumnIndex(headerRow: unknown[]) {
  return headerRow.findIndex((cell) => {
    const value = normalizeCell(cell).toLocaleLowerCase("pl-PL");
    return value === "i dyżur";
  });
}

function getWorksheetName(workbook: XLSX.WorkBook) {
  const exactPlan = workbook.SheetNames.find(
    (name) => name.trim().toLocaleLowerCase("pl-PL") === "plan",
  );

  if (exactPlan) {
    return exactPlan;
  }

  return workbook.SheetNames[0];
}

function detectHeaderAndDataStart(rawRows: unknown[][]) {
  for (let rowIndex = 1; rowIndex < rawRows.length; rowIndex += 1) {
    const currentRow = rawRows[rowIndex] ?? [];
    const previousRow = rawRows[rowIndex - 1] ?? [];

    const dateCandidate = normalizeDate(currentRow[0]);
    if (!dateCandidate) continue;

    const dutyColumnIndex = findDutyColumnIndex(previousRow);
    if (dutyColumnIndex <= 3) continue;

    const hasAtLeastOneEmployeeName = previousRow
      .slice(3, dutyColumnIndex)
      .some((cell) => normalizeCell(cell) !== "");

    if (!hasAtLeastOneEmployeeName) continue;

    return {
      headerRowIndex: rowIndex - 1,
      dataStartRowIndex: rowIndex,
      dutyColumnIndex,
    };
  }

  throw new Error(
    "Nie udało się znaleźć wiersza nagłówków i początku danych w arkuszu Plan.",
  );
}

function extractEmployeeColumns(
  headerRow: unknown[],
  startColumnIndex: number,
  endColumnIndexExclusive: number,
): EmployeeColumn[] {
  const employees: EmployeeColumn[] = [];

  for (
    let columnIndex = startColumnIndex;
    columnIndex < endColumnIndexExclusive;
    columnIndex += 1
  ) {
    const name = normalizeCell(headerRow[columnIndex]);

    if (!name) continue;

    employees.push({
      name,
      columnIndex,
    });
  }

  if (!employees.length) {
    throw new Error("Nie znaleziono żadnych nazwisk w arkuszu Plan.");
  }

  return employees;
}

export function parseScheduleWorkbook(
  buffer: Buffer,
  options: ParseScheduleWorkbookOptions = {},
): ScheduleData {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
    raw: true,
  });

  const sheetName = getWorksheetName(workbook);

  if (!sheetName) {
    throw new Error("Workbook nie zawiera żadnego arkusza.");
  }

  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    throw new Error(`Nie znaleziono arkusza ${sheetName}.`);
  }

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

  const { headerRowIndex, dataStartRowIndex, dutyColumnIndex } =
    detectHeaderAndDataStart(rawRows);

  const headerRow = rawRows[headerRowIndex] ?? [];
  const employeeColumns = extractEmployeeColumns(headerRow, 3, dutyColumnIndex);
  const maxDate = options.maxDate?.trim() || "";

  const rows: ScheduleRow[] = rawRows
    .slice(dataStartRowIndex)
    .map((row) => {
      const date = normalizeDate(row[0]);

      if (!date) return null;
      if (date < MIN_SCHEDULE_DATE) return null;
      if (maxDate && date > maxDate) return null;

      const employeesMap: Record<string, string> = {};

      for (const employee of employeeColumns) {
        employeesMap[employee.name] = normalizeCell(row[employee.columnIndex]);
      }

      return {
        date,
        employees: employeesMap,
      };
    })
    .filter((row): row is ScheduleRow => Boolean(row));

  if (!rows.length) {
    throw new Error(
      "Nie znaleziono żadnych wierszy grafiku w wybranym zakresie dat.",
    );
  }

  return {
    employees: employeeColumns.map((employee) => employee.name),
    rows,
    meta: {
      sheetName,
      loadedAt: new Date().toISOString(),
      source: "microsoft-graph",
      loadedUntil: maxDate || null,
    },
  };
}
