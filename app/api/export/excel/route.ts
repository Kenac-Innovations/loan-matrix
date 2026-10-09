import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";

interface ExportRow {
  row_type: string | null;
  cells: (string | number | null)[];
}

interface ExportRequest {
  filename: string;
  headers: string[];
  rows: ExportRow[];
}

const BOLD_ROW_TYPES = new Set([
  "HEADER",
  "SECTION",
  "GROUP",
  "SUBTOTAL",
  "TOTAL",
  "GROUP_TOTAL",
  "SECTION_TOTAL",
  "GRAND_TOTAL",
]);
const TOTAL_ROW_TYPES = new Set([
  "TOTAL",
  "GROUP_TOTAL",
  "SECTION_TOTAL",
  "GRAND_TOTAL",
]);
const SECTION_ROW_TYPES = new Set(["SECTION", "GROUP"]);
const TRIAL_BALANCE_HEADERS = new Set([
  "account",
  "opening",
  "debit",
  "credit",
  "closing",
]);

function firstVisibleCell(row: ExportRow) {
  return row.cells.find(
    (cell) => cell !== null && cell !== undefined && String(cell).trim() !== ""
  );
}

export async function POST(req: NextRequest) {
  const body: ExportRequest = await req.json();
  const { filename, headers, rows } = body;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Report");
  const normalizedHeaders = headers.map((header) => header.toLowerCase());
  const isTrialBalanceLayout =
    TRIAL_BALANCE_HEADERS.size === normalizedHeaders.length &&
    normalizedHeaders.every((header) => TRIAL_BALANCE_HEADERS.has(header)) &&
    rows.some(
      (row) => row.row_type === "TITLE" || row.row_type === "METADATA"
    );
  const titleRows = isTrialBalanceLayout
    ? rows.filter((row) => row.row_type === "TITLE")
    : [];
  const metadataRows = isTrialBalanceLayout
    ? rows.filter((row) => row.row_type === "METADATA")
    : [];
  const dataRows = isTrialBalanceLayout
    ? rows.filter(
        (row) => row.row_type !== "TITLE" && row.row_type !== "METADATA"
      )
    : rows;
  const amountColumnIndexes = headers
    .map((header, index) =>
      ["opening", "debit", "credit", "closing"].includes(
        header.toLowerCase()
      )
        ? index + 1
        : -1
    )
    .filter((index) => index > 0);

  sheet.columns = headers.map((h) => ({
    key: h,
    width: isTrialBalanceLayout
      ? h.toLowerCase() === "account"
        ? 48
        : 18
      : h.toLowerCase() === "balance" || h.toLowerCase() === "amount"
        ? 20
        : 40,
  }));

  if (isTrialBalanceLayout) {
    titleRows.forEach((row, index) => {
      const titleRow = sheet.addRow([firstVisibleCell(row) ?? null]);
      sheet.mergeCells(titleRow.number, 1, titleRow.number, headers.length);
      titleRow.font = {
        bold: true,
        size: index === 0 ? 14 : 12,
      };
      titleRow.alignment = { horizontal: "center" };
    });

    const metadata = metadataRows
      .map(firstVisibleCell)
      .filter(
        (value): value is string | number => value !== null && value !== undefined
      )
      .map(String);
    if (metadata.length > 0) {
      const metadataRow = sheet.addRow([metadata.join("   ")]);
      sheet.mergeCells(metadataRow.number, 1, metadataRow.number, headers.length);
      metadataRow.font = { bold: true };
      metadataRow.alignment = { horizontal: "center" };
    }

    sheet.addRow([]);
  }

  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: "middle" };
  if (isTrialBalanceLayout) {
    headerRow.eachCell((cell, index) => {
      cell.alignment = {
        horizontal: index === 1 ? "left" : "center",
        vertical: "middle",
      };
    });
    sheet.addRow([]);
  } else {
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };
  }

  let previousRowType: string | null = null;
  dataRows.forEach((row) => {
    const isSection = row.row_type
      ? SECTION_ROW_TYPES.has(row.row_type)
      : false;
    const isTotal = row.row_type ? TOTAL_ROW_TYPES.has(row.row_type) : false;

    if (
      isTrialBalanceLayout &&
      previousRowType !== null &&
      (isSection || isTotal)
    ) {
      sheet.addRow([]);
    }

    const dataRow = sheet.addRow(row.cells);
    const isBold = row.row_type ? BOLD_ROW_TYPES.has(row.row_type) : false;

    if (isBold) {
      dataRow.font = { bold: true };
    }

    if (isTrialBalanceLayout) {
      amountColumnIndexes.forEach((index) => {
        dataRow.getCell(index).numFmt = '#,##0.00;(#,##0.00);-';
      });
    }

    if (isTotal && !isTrialBalanceLayout) {
      dataRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = {
          top: { style: "double" },
          bottom: { style: "double" },
        };
      });
    }

    previousRowType = row.row_type;
  });

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
    },
  });
}
