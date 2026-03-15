import { NextRequest, NextResponse } from "next/server";
import { extractTenantSlug } from "./tenant-service";

export async function tenantMiddleware(request: NextRequest) {
  const host = request.headers.get("host");

  if (!host) {
    return NextResponse.next();
  }

  const tenantSlug = extractTenantSlug(host);

  // Skip tenant resolution for API routes that don't need it
  const pathname = request.nextUrl.pathname;
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Add tenant slug to headers for downstream consumption
  // The actual tenant validation will happen in server components/actions
  const response = NextResponse.next();
  response.headers.set("x-tenant-slug", tenantSlug);

  return response;
}
