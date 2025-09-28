import { NextRequest, NextResponse } from "next/server";
import { getUssdLeadsData } from "@/app/actions/ussd-leads-actions";

export async function GET(request: NextRequest) {
  try {
    // Get tenant from x-tenant-slug header or default to "default"
    const tenantSlug = request.headers.get("x-tenant-slug") || "default";
    
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const ussdLeadsData = await getUssdLeadsData(tenantSlug, {
      status: status || undefined,
      limit,
      offset,
    });

    return NextResponse.json(ussdLeadsData);
  } catch (error) {
    console.error("Error fetching USSD leads:", error);
    return NextResponse.json(
      { error: "Failed to fetch USSD leads" },
      { status: 500 }
    );
  }
}
