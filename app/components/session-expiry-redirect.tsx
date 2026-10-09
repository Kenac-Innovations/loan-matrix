"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

const PUBLIC_PATH_PREFIXES = ["/auth", "/reset-password"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function SessionExpiryRedirect() {
  const { status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (
      status !== "unauthenticated" ||
      isPublicPath(pathname) ||
      hasRedirected.current
    ) {
      return;
    }

    hasRedirected.current = true;
    const callbackUrl = `${window.location.pathname}${window.location.search}`;
    router.replace(`/auth/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }, [pathname, router, status]);

  return null;
}
