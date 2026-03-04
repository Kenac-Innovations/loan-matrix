import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { tenantMiddleware } from "./lib/tenant-middleware";

const AUTH_BYPASS_PREFIXES = [
  "/auth",
  "/_next",
  "/static",
];

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  "Pragma": "no-cache",
  "Expires": "0",
} as const;

function isStaticAsset(pathname: string): boolean {
  if (AUTH_BYPASS_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return true;
  }
  if (pathname.includes(".")) {
    return true;
  }
  return false;
}

function setNoCacheHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(NO_CACHE_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const tenantResponse = await tenantMiddleware(request);
  if (tenantResponse && tenantResponse.status !== 200) {
    return tenantResponse;
  }

  const next = () => tenantResponse || NextResponse.next();

  if (pathname.startsWith("/api")) {
    return setNoCacheHeaders(next());
  }

  if (isStaticAsset(pathname)) {
    if (pathname === "/auth/login") {
      try {
        const token = await getToken({
          req: request,
          secret: process.env.NEXTAUTH_SECRET,
        });
        if (token) {
          return NextResponse.redirect(new URL("/leads", request.url));
        }
      } catch {
        // Fall through to show login page
      }
    }
    return next();
  }

  // --- All remaining paths require authentication ---

  let token;
  try {
    token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });
  } catch (error) {
    console.error("Middleware token error:", error);
    token = null;
  }

  if (!token) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("callbackUrl", encodeURI(request.url));
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/leads", request.url));
  }

  return setNoCacheHeaders(next());
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
