import { NextRequest, NextResponse } from "next/server";
import { getBranchCollectionPerformance } from "@/lib/fineract-collections";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const data = await getBranchCollectionPerformance({
      fromDate: searchParams.get("startDate") ?? searchParams.get("R_startDate") ?? searchParams.get("fromDate"),
      toDate: searchParams.get("endDate") ?? searchParams.get("R_endDate") ?? searchParams.get("toDate"),
      officeId: searchParams.get("officeId") ?? searchParams.get("R_officeId"),
    });

    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Error fetching branch collection performance:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch branch collection performance",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
