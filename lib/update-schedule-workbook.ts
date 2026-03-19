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

function normalizeDateValue(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const primitive = extractCellRawValue(value as ExcelJS.CellValue);

  if (primitive instanceof Date && !Number.isNaN(primitive.getTime())) {
    return primitive.toISOString().slice(0, 10);
  }

  const text = normalizePrimitive(primitive);
  if (!text) return "";

  const parsedText = parsePolishLikeDateText(text);
  if (parsedText) {
    return parsedText;
  }

  return "";
}

function findDutyColumnIndex(headerRow: ExcelJS.Row) {
  for (
    let columnIndex = 1;
    columnIndex <= headerRow.cellCount;
    columnIndex += 1
  ) {
    const value = normalizeCellValue(
      headerRow.getCell(columnIndex).value,
    ).toLocaleLowerCase("pl-PL");

    if (value === "i dyżur") {
      return columnIndex;
    }
  }

  return -1;
}

function detectLayout(worksheet: ExcelJS.Worksheet) {
  for (let rowIndex = 2; rowIndex <= worksheet.rowCount; rowIndex += 1) {
    const currentRow = worksheet.getRow(rowIndex);
    const previousRow = worksheet.getRow(rowIndex - 1);

    const dateCandidate = normalizeDateValue(currentRow.getCell(1).value);
    if (!dateCandidate) continue;

    const dutyColumnIndex = findDutyColumnIndex(previousRow);
    if (dutyColumnIndex <= 4) continue;

    let hasAtLeastOneEmployeeName = false;

    for (let columnIndex = 4; columnIndex < dutyColumnIndex; columnIndex += 1) {
      const value = normalizeCellValue(previousRow.getCell(columnIndex).value);
      if (value) {
        hasAtLeastOneEmployeeName = true;
        break;
      }
    }

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

  const worksheet = workbook.getWorksheet("Plan") ?? workbook.worksheets[0];

  if (!worksheet) {
    throw new Error("Workbook nie zawiera żadnego arkusza.");
  }

  const { headerRowIndex, dataStartRowIndex, dutyColumnIndex } =
    detectLayout(worksheet);

  const headerRow = worksheet.getRow(headerRowIndex);

  const employeeColumnMap = new Map<string, number>();

  for (let columnIndex = 4; columnIndex < dutyColumnIndex; columnIndex += 1) {
    const employeeName = normalizeCellValue(
      headerRow.getCell(columnIndex).value,
    );

    if (employeeName) {
      employeeColumnMap.set(employeeName, columnIndex);
    }
  }

  const dateRowMap = new Map<string, number>();

  for (
    let rowIndex = dataStartRowIndex;
    rowIndex <= worksheet.rowCount;
    rowIndex += 1
  ) {
    const row = worksheet.getRow(rowIndex);
    const normalizedDate = normalizeDateValue(row.getCell(1).value);

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
