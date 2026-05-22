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

const BOLD_ROW_TYPES = new Set(["HEADER", "SUBTOTAL", "TOTAL"]);
const TOTAL_ROW_TYPES = new Set(["TOTAL"]);

export async function POST(req: NextRequest) {
  const body: ExportRequest = await req.json();
  const { filename, headers, rows } = body;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Report");

  sheet.columns = headers.map((h) => ({
    header: h,
    key: h,
    width: h.toLowerCase() === "balance" || h.toLowerCase() === "amount" ? 20 : 40,
  }));

  // Style the header row
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };

  rows.forEach((row) => {
    const dataRow = sheet.addRow(row.cells);
    const isBold = row.row_type ? BOLD_ROW_TYPES.has(row.row_type) : false;
    const isTotal = row.row_type ? TOTAL_ROW_TYPES.has(row.row_type) : false;

    if (isBold) {
      dataRow.font = { bold: true };
    }

    if (isTotal) {
      dataRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = {
          top: { style: "double" },
          bottom: { style: "double" },
        };
      });
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
    },
  });
}
