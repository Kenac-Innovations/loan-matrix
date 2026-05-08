import { NextRequest, NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const officeId = searchParams.get("officeId");

    if (!officeId) {
      return NextResponse.json(
        { success: false, error: "officeId is required" },
        { status: 400 }
      );
    }

    const [holidays, workingDays] = await Promise.all([
      fetchFineractAPI(`/holidays?officeId=${encodeURIComponent(officeId)}`, {
        method: "GET",
        cache: "no-store",
      }),
      fetchFineractAPI("/workingdays", {
        method: "GET",
        cache: "no-store",
      }),
    ]);

    return NextResponse.json({
      officeId: Number(officeId),
      holidays: Array.isArray(holidays) ? holidays : [],
      workingDays: workingDays && typeof workingDays === "object" ? workingDays : null,
    });
  } catch (error) {
    console.error("Error fetching Fineract business calendar:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        success: false,
        error: `Failed to fetch Fineract business calendar: ${message}`,
      },
      { status: 500 }
    );
  }
}
