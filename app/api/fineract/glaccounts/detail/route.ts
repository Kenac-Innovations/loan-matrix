import { NextRequest, NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";

/**
 * GET /api/fineract/glaccounts/detail
 * Fetch GL accounts with optional filters
 * Query params:
 *   - manualEntriesAllowed: boolean (optional)
 *   - usage: 1 for detail accounts, 2 for header accounts (optional)
 *   - disabled: boolean (optional, default: false)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const manualEntriesAllowed = searchParams.get("manualEntriesAllowed");
    const usage = searchParams.get("usage");
    const disabled = searchParams.get("disabled") ?? "false";

    const queryParams = new URLSearchParams();
    
    // Only add filters if explicitly provided
    if (manualEntriesAllowed !== null) {
      queryParams.append("manualEntriesAllowed", manualEntriesAllowed);
    }
    if (usage !== null) {
      queryParams.append("usage", usage);
    }
    queryParams.append("disabled", disabled);

    const queryString = queryParams.toString();
    const url = queryString ? `/glaccounts?${queryString}` : "/glaccounts";
    
    const data = await fetchFineractAPI(url);
    
    // Sort by glCode for easier selection
    const sortedData = Array.isArray(data) 
      ? data.sort((a: any, b: any) => (a.glCode || "").localeCompare(b.glCode || ""))
      : data;

    return NextResponse.json(sortedData);
  } catch (error: any) {
    console.error("Error fetching GL accounts:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
