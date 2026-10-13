import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireInventoryReportAccess,
  InventoryAccessError,
} from "@/lib/inventory/inventory-access";
import { parseInventoryReportFilters } from "@/lib/inventory/inventory-report-types";
import { getInventoryReport } from "@/lib/inventory/inventory-report-service";
import { exportInventoryReport } from "@/lib/inventory/inventory-report-export";
export async function GET(request: NextRequest) {
  try {
    const access = await requireInventoryReportAccess();
    const format = request.nextUrl.searchParams.get("format");
    if (format !== "csv" && format !== "xlsx")
      return NextResponse.json(
        { error: "Select CSV or Excel." },
        { status: 400 },
      );
    const filters = parseInventoryReportFilters(request.nextUrl.searchParams);
    const report = await getInventoryReport(prisma, access, filters, true);
    const bytes = await exportInventoryReport(report, format);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type":
          format === "csv"
            ? "text/csv; charset=utf-8"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="arda-stock-${filters.kind}.${format}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json(
        { error: error.issues.map((i) => i.message).join("; ") },
        { status: 400 },
      );
    if (error instanceof InventoryAccessError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    console.error("Inventory report export failed", error);
    return NextResponse.json(
      { error: "The report could not be exported. Try narrowing the filters." },
      { status: 500 },
    );
  }
}
