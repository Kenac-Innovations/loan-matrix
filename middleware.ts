import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { tenantMiddleware } from "./lib/tenant-middleware";

const PUBLIC_PATH_PREFIXES = [
  "/auth",
  "/api",
  "/_next",
  "/static",
];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return true;
  }
  // Static assets (favicon.ico, images, fonts, etc.)
  if (pathname.includes(".")) {
    return true;
  }
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const tenantResponse = await tenantMiddleware(request);
  if (tenantResponse && tenantResponse.status !== 200) {
    return tenantResponse;
  }

  const next = () => tenantResponse || NextResponse.next();

  if (isPublicPath(pathname)) {
    // Authenticated users on the login page get redirected to /leads
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

  // Authenticated user on root → redirect to /leads
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/leads", request.url));
  }

  return next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
