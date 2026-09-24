import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getTenantBySlug, extractTenantSlugFromRequest } from "@/lib/tenant-service";
import { isLeadContractsBackendEnabled } from "@/lib/lead-contracts-backend-flag";

/**
 * GET /api/leads/[id]/contracts/mode
 * Returns whether backend mode is enabled for this tenant
 * Never returns 404, always indicates whether the backend is available
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantSlug = extractTenantSlugFromRequest(request);
    const tenant = await getTenantBySlug(tenantSlug);
    const backendEnabled = isLeadContractsBackendEnabled(tenant?.slug ?? null);

    return NextResponse.json({ backend: backendEnabled });
  } catch (error) {
    console.error("Error checking contracts mode:", error);
    return NextResponse.json({ backend: false });
  }
}
