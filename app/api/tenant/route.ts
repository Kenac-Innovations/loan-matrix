import { NextResponse } from "next/server";
import { getTenantFromHeaders } from "@/lib/tenant-service";

/**
 * GET /api/tenant
 * Returns the current tenant info (from host/headers), including logo URL when set.
 */
export async function GET() {
  const tenant = await getTenantFromHeaders();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }
  return NextResponse.json({
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    logoFileUrl: tenant.logoFileUrl ?? null,
    logoLinkId: tenant.logoLinkId ?? null,
  });
}
