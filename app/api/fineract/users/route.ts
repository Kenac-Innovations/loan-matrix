import { NextRequest, NextResponse } from "next/server";
import { FineractAPIService } from "@/lib/fineract-api";
import { getFineractTenantId } from "@/lib/fineract-tenant-service";
import { extractTenantSlug } from "@/lib/tenant-service";

// GET /api/fineract/users - Fetch all Mifos/Fineract users
export async function GET(request: NextRequest) {
  try {
    // Get tenant from headers
    const tenantSlug =
      request.headers.get("x-tenant-slug") ||
      extractTenantSlug(
        request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
        request.headers.get("host") ||
        ""
      );

    const tenantId = await getFineractTenantId(tenantSlug);

    const fineractService = new FineractAPIService({
      baseUrl: process.env.FINERACT_BASE_URL || "http://10.10.0.143",
      username: process.env.FINERACT_USERNAME || "mifos",
      password: process.env.FINERACT_PASSWORD || "password",
      tenantId: tenantId,
    });

    // Fetch users from Fineract API
    const users = await fineractService.getUsers();

    // Map to a simpler format
    const mappedUsers = users.map((user: any) => ({
      id: user.id,
      username: user.username,
      firstname: user.firstname,
      lastname: user.lastname,
      displayName: `${user.firstname || ""} ${user.lastname || ""}`.trim() || user.username,
      email: user.email,
      officeId: user.officeId,
      officeName: user.officeName,
      roles: user.selectedRoles?.map((role: any) => role.name) || [],
    }));

    return NextResponse.json({
      success: true,
      users: mappedUsers,
    });
  } catch (error: any) {
    console.error("Error fetching Fineract users:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch users",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
