import { NextRequest, NextResponse } from "next/server";
import { getRecoveryDashboardData } from "@/lib/fineract-recoveries";
import { normalizeRecoveryBucket } from "@/app/api/recoveries/_utils";

function parsePositiveInt(value: string | null, fallback: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(Math.floor(parsed), max);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bucket = normalizeRecoveryBucket(searchParams.get("bucket"));
    const page = parsePositiveInt(searchParams.get("page"), 1, 100000);
    const pageSize = parsePositiveInt(searchParams.get("pageSize"), 25, 100);
    const data = await getRecoveryDashboardData(bucket, { page, pageSize });

    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Error fetching recovery arrears data:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch recovery arrears data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
