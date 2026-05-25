import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getFineractTenantId } from "@/lib/fineract-tenant-service";

/**
 * GET /api/tenant/roles
 *
 * Enumerates all Fineract roles defined for the current tenant. Used by the
 * Feature Flags admin page to populate the "per-role overrides" picker.
 *
 * Auth: requires an authenticated session. The Fineract `/roles` endpoint
 * itself enforces role-permission; if the calling user can't read roles
 * we fall back to the roles attached to their own session so the UI can
 * still render at least their own row.
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.userId) {
      return NextResponse.json({ roles: [] }, { status: 200 });
    }

    const fineractTenantId = await getFineractTenantId();
    const baseUrl =
      process.env.FINERACT_BASE_URL || "http://mifos-be.kenac.co.zw";
    const authToken =
      session.base64EncodedAuthenticationKey || session.accessToken;

    const rolesUrl = `${baseUrl}/fineract-provider/api/v1/roles`;

    let roles: Array<{ id: number; name: string; disabled?: boolean }> = [];
    try {
      const res = await fetch(rolesUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${authToken}`,
          "Fineract-Platform-TenantId": fineractTenantId,
        },
      });
      if (res.ok) {
        const data = (await res.json()) as Array<{
          id: number;
          name: string;
          disabled?: boolean;
        }>;
        roles = data
          .filter((r) => !r.disabled)
          .map((r) => ({ id: r.id, name: r.name, disabled: r.disabled }));
      }
    } catch (err) {
      console.error("[/api/tenant/roles] Fineract /roles failed:", err);
    }

    // Fallback to the session's own roles if the API call gave us nothing.
    if (roles.length === 0 && Array.isArray(session.user.roles)) {
      roles = session.user.roles
        .filter((r) => r && !r.disabled)
        .map((r) => ({ id: r.id, name: r.name, disabled: r.disabled }));
    }

    // Stable alphabetical ordering for the UI.
    roles.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ roles });
  } catch (error) {
    console.error("Error fetching tenant roles:", error);
    return NextResponse.json({ roles: [] }, { status: 200 });
  }
}
