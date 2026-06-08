import { NextResponse } from "next/server";
import { getCourtCasesReport } from "@/lib/fineract-recoveries";

export async function GET() {
  try {
    const rows = await getCourtCasesReport();
    return NextResponse.json({ rows }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Error fetching court cases report:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch court cases report",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
