import { NextRequest, NextResponse } from "next/server";
import { getLeadsData } from "@/app/actions/leads-actions";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantSlug = request.headers.get("x-tenant-slug") || "default";

    const stage = searchParams.get("stage") || undefined;
    const status = searchParams.get("status") || undefined;
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = parseInt(searchParams.get("offset") || "0");

    const leadsData = await getLeadsData(tenantSlug, {
      stage,
      status,
      limit,
      offset,
    });

    return NextResponse.json(leadsData);
  } catch (error) {
    console.error("Error fetching paginated leads:", error);
    return NextResponse.json(
      { error: "Failed to fetch leads" },
      { status: 500 }
    );
  }
}
