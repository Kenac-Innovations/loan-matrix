import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { tenantMiddleware } from "./lib/tenant-middleware";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Apply tenant middleware first
  const tenantResponse = await tenantMiddleware(request);
  if (tenantResponse && tenantResponse.status !== 200) {
    return tenantResponse;
  }

  // Check if the path is a protected route
  const isProtectedRoute =
    pathname.startsWith("/(application)") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/leads");

  // Skip middleware for API and public routes
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.startsWith("/auth") ||
    pathname.includes(".") // Files like favicon.ico, etc.
  ) {
    return tenantResponse || NextResponse.next();
  }

  // Get the NextAuth.js token
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // If the route is protected and the user is not authenticated, redirect to login
  if (isProtectedRoute && !token) {
    const url = new URL("/auth/login", request.url);
    url.searchParams.set("callbackUrl", encodeURI(request.url));
    return NextResponse.redirect(url);
  }

  // If the user is authenticated and trying to access login page, redirect to dashboard
  if (pathname === "/auth/login" && token) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // If the user is authenticated and accessing the root, redirect to dashboard
  if (pathname === "/" && token) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return tenantResponse || NextResponse.next();
}

// Configure the middleware to run on specific paths
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
