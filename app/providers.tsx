"use client";

import { SessionProvider } from "next-auth/react";
import { AuthProvider } from "@/contexts/auth-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider
      refetchInterval={5 * 60} // Refetch session every 5 minutes
      refetchOnWindowFocus={true}
    >
      <AuthProvider>{children}</AuthProvider>
    </SessionProvider>
  );
}
