import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { exportInventoryReport } from "../inventory/inventory-report-export";
import type { InventoryReportResult } from "../inventory/inventory-report-types";
const report: InventoryReportResult = {
  columns: [
    { key: "Item", type: "text" },
    { key: "Value", type: "decimal" },
  ],
  rows: [{ Item: '=HYPERLINK("bad")', Value: "123456789012345.67" }],
  totalRows: 1,
  totals: {},
  generatedAt: "2026-10-13T00:00:00Z",
  positionBasis: "current",
  timezone: "UTC",
};
test("CSV protects formula-like text while preserving exact decimals", async () => {
  const text = new TextDecoder().decode(
    await exportInventoryReport(report, "csv"),
  );
  assert.match(text, /'=HYPERLINK/);
  assert.match(text, /123456789012345.67/);
});
test("Excel exports precise decimal strings and no formulas", async () => {
  const bytes = await exportInventoryReport(report, "xlsx");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(bytes) as never);
  assert.equal(
    workbook.worksheets[0].getCell("A2").type,
    ExcelJS.ValueType.String,
  );
  assert.equal(
    workbook.worksheets[0].getCell("B2").value,
    "123456789012345.67",
  );
  await assert.rejects(
    exportInventoryReport({ ...report, totalRows: 50001 }, "xlsx"),
    /50,000|narrow/i,
  );
});
