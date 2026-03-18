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

  // Propagate tenant slug as a request header so downstream handlers
  // (API routes, server actions, server components) can read it via
  // request.headers.get("x-tenant-slug") or headers().get("x-tenant-slug").
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-tenant-slug", tenantSlug);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("x-tenant-slug", tenantSlug);

  return response;
}
