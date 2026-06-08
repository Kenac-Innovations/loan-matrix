import { NextResponse } from "next/server";
import { getCourtProceedingsReport } from "@/lib/fineract-recoveries";

export async function GET() {
  try {
    const rows = await getCourtProceedingsReport();
    return NextResponse.json({ rows }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Error fetching court proceedings report:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch court proceedings report",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
