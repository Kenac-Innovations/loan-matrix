import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { tenantMiddleware } from "./lib/tenant-middleware";

const PUBLIC_PREFIXES = [
  "/auth",
  "/_next",
  "/static",
];

const PUBLIC_API_PREFIXES = [
  "/api/auth",
  "/api/webhooks",
  "/api/ussd-leads/payment-callback",
  "/api/queue/health",
  "/api/tenant",
  "/api/init",
];

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  "Pragma": "no-cache",
  "Expires": "0",
} as const;

function getRequestOrigin(request: NextRequest): string {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host") || request.nextUrl.host;
  const proto =
    forwardedProto ||
    request.nextUrl.protocol.replace(":", "") ||
    (host?.includes("localhost") || host?.startsWith("127.") || host?.startsWith("0.0.0.0")
      ? "http"
      : "https");

  return `${proto}://${host}`;
}

function buildAppUrl(request: NextRequest, pathname: string): URL {
  return new URL(pathname, getRequestOrigin(request));
}

function getSafeCallbackPath(request: NextRequest): string {
  const callbackPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  if (
    !callbackPath ||
    callbackPath === "/" ||
    callbackPath.startsWith("/auth") ||
    callbackPath.startsWith("/api/auth")
  ) {
    return "/leads";
  }

  return callbackPath;
}

function isPublicPage(pathname: string): boolean {
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return true;
  }
  if (pathname.includes(".")) {
    return true;
  }
  return false;
}

function isPublicApi(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function setNoCacheHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(NO_CACHE_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

async function getSessionToken(request: NextRequest) {
  try {
    return await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });
  } catch (error) {
    console.error("Middleware token error:", error);
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const tenantResponse = await tenantMiddleware(request);
  if (tenantResponse && tenantResponse.status !== 200) {
    return tenantResponse;
  }

  const next = () => tenantResponse || NextResponse.next();

  // --- API routes ---
  if (pathname.startsWith("/api")) {
    if (isPublicApi(pathname)) {
      return setNoCacheHeaders(next());
    }

    const token = await getSessionToken(request);
    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    return setNoCacheHeaders(next());
  }

  // --- Public pages (auth, static assets) ---
  if (isPublicPage(pathname)) {
    if (pathname === "/auth/login") {
      const token = await getSessionToken(request);
      if (token) {
        return NextResponse.redirect(buildAppUrl(request, "/leads"));
      }
    }
    return next();
  }

  // --- All remaining paths require authentication ---

  const token = await getSessionToken(request);

  if (!token) {
    const loginUrl = buildAppUrl(request, "/auth/login");
    loginUrl.searchParams.set("callbackUrl", getSafeCallbackPath(request));
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/") {
    return NextResponse.redirect(buildAppUrl(request, "/leads"));
  }

  return setNoCacheHeaders(next());
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
