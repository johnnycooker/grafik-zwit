// lib/update-schedule-workbook.ts

import ExcelJS from "exceljs";
import type { ScheduleData } from "@/lib/parse-schedule";

type UpdateWorkbookResult = {
  buffer: Buffer;
  summary: {
    sheetName: string;
    changedCells: number;
    missingEmployees: string[];
    missingDates: string[];
  };
};

function normalizePrimitive(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeDateValue(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number") {
    return String(value);
  }

  const text = normalizePrimitive(value);
  if (!text) return "";

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return text;
}

function extractCellRawValue(value: ExcelJS.CellValue): unknown {
  if (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value instanceof Date
  ) {
    return value;
  }

  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") {
      return value.text;
    }

    if ("result" in value) {
      return value.result;
    }

    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("");
    }

    if ("hyperlink" in value && typeof value.hyperlink === "string") {
      return "text" in value && typeof value.text === "string"
        ? value.text
        : value.hyperlink;
    }
  }

  return value;
}

function normalizeCellValue(value: ExcelJS.CellValue): string {
  return normalizePrimitive(extractCellRawValue(value));
}

function normalizeCellDate(value: ExcelJS.CellValue): string {
  return normalizeDateValue(extractCellRawValue(value));
}

export async function applyScheduleDataToWorkbook(
  inputBuffer: Buffer,
  scheduleData: ScheduleData,
): Promise<UpdateWorkbookResult> {
  const workbook = new ExcelJS.Workbook();

  const arrayBuffer = inputBuffer.buffer.slice(
    inputBuffer.byteOffset,
    inputBuffer.byteOffset + inputBuffer.byteLength,
  ) as ArrayBuffer;

  await workbook.xlsx.load(arrayBuffer);

  const worksheet = workbook.worksheets[0];

  if (!worksheet) {
    throw new Error("Workbook nie zawiera żadnego arkusza.");
  }

  const headerRow = worksheet.getRow(1);
  const firstCell = normalizeCellValue(
    headerRow.getCell(1).value,
  ).toLowerCase();

  const hasDateColumn =
    firstCell === "data" || firstCell === "date" || firstCell.includes("data");

  if (!hasDateColumn) {
    throw new Error(
      "Nie znaleziono kolumny daty w pierwszej kolumnie arkusza.",
    );
  }

  const employeeColumnMap = new Map<string, number>();

  for (
    let columnIndex = 2;
    columnIndex <= worksheet.columnCount;
    columnIndex += 1
  ) {
    const employeeName = normalizeCellValue(
      headerRow.getCell(columnIndex).value,
    );

    if (employeeName) {
      employeeColumnMap.set(employeeName, columnIndex);
    }
  }

  const dateRowMap = new Map<string, number>();

  for (let rowIndex = 2; rowIndex <= worksheet.rowCount; rowIndex += 1) {
    const row = worksheet.getRow(rowIndex);
    const normalizedDate = normalizeCellDate(row.getCell(1).value);

    if (normalizedDate) {
      dateRowMap.set(normalizedDate, rowIndex);
    }
  }

  const missingEmployees = new Set<string>();
  const missingDates = new Set<string>();
  let changedCells = 0;

  for (const row of scheduleData.rows) {
    const worksheetRowIndex = dateRowMap.get(row.date);

    if (!worksheetRowIndex) {
      missingDates.add(row.date);
      continue;
    }

    const worksheetRow = worksheet.getRow(worksheetRowIndex);

    for (const employee of scheduleData.employees) {
      const columnIndex = employeeColumnMap.get(employee);

      if (!columnIndex) {
        missingEmployees.add(employee);
        continue;
      }

      const cell = worksheetRow.getCell(columnIndex);
      const previousValue = normalizeCellValue(cell.value);
      const nextValue = row.employees[employee] ?? "";

      if (previousValue !== nextValue) {
        changedCells += 1;
      }

      cell.value = nextValue || null;
    }
  }

  const output = await workbook.xlsx.writeBuffer();

  return {
    buffer: Buffer.from(output),
    summary: {
      sheetName: worksheet.name,
      changedCells,
      missingEmployees: [...missingEmployees],
      missingDates: [...missingDates],
    },
  };
}
