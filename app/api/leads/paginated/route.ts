import { NextRequest, NextResponse } from "next/server";
import { getLeadsData } from "@/app/actions/leads-actions";
import { extractTenantSlugFromRequest } from "@/lib/tenant-service";

/**
 * GET /api/leads/paginated
 *
 * Visibility scoping (loan officer sees their own / assigned leads, branch
 * manager sees branch leads, admin sees everything) is enforced inside
 * `getLeadsData` via `lib/lead-access.ts`. We no longer compute the role
 * filter here.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantSlug = extractTenantSlugFromRequest(request);

    const stage = searchParams.get("stage") || undefined;
    const status = searchParams.get("status") || undefined;
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const skipFineractStatus = searchParams.get("skipFineractStatus") === "true";
    const search = searchParams.get("search") || undefined;
    const leadStatus = searchParams.get("leadStatus") || undefined;

    const leadsData = await getLeadsData(tenantSlug, {
      stage,
      status,
      limit,
      offset,
      skipFineractStatus,
      search,
      leadStatus,
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
