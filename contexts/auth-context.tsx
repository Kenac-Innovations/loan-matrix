"use client";

import React, { createContext, useContext } from "react";
import { signIn, signOut, useSession, getSession } from "next-auth/react";
import type { MfaChannel } from "@/shared/types/tenant";

type LoginResult =
  | { success: true }
  | {
      success: false;
      error: string;
      requiresMfa?: false;
      requiresChannelSelection?: false;
    }
  | {
      success: false;
      requiresMfa: true;
      challengeId: string;
      channel: MfaChannel;
      maskedDestination: string;
    }
  | {
      success: false;
      requiresMfa: true;
      requiresChannelSelection: true;
      availableChannels: MfaChannel[];
      destinations: Partial<Record<MfaChannel, string | null>>;
    };

type AuthContextType = {
  status: "loading" | "authenticated" | "unauthenticated";
  user: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
  login: (
    username: string,
    password: string,
    channel?: MfaChannel
  ) => Promise<LoginResult>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  status: "loading",
  user: null,
  login: async () => ({ success: false, error: "Authentication unavailable" }),
  logout: async () => {},
});

// Custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);

// Provider component that wraps the app and makes auth available
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status: sessionStatus } = useSession();

  const hasActiveSession = async (
    attempts = 5,
    delayMs = 120
  ): Promise<boolean> => {
    for (let attempt = 0; attempt < attempts; attempt++) {
      const currentSession = await getSession();
      if (currentSession) {
        return true;
      }

      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return false;
  };

  const waitForSessionToClear = async (
    attempts = 10,
    delayMs = 120
  ): Promise<boolean> => {
    for (let attempt = 0; attempt < attempts; attempt++) {
      const currentSession = await getSession();
      if (!currentSession) {
        return true;
      }

      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return false;
  };

  const login = async (
    username: string,
    password: string,
    channel?: MfaChannel
  ): Promise<LoginResult> => {
    try {
      const mfaStartRes = await fetch("/api/auth/mfa/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, channel }),
      });
      const mfaStartData = await mfaStartRes.json();

      if (!mfaStartRes.ok || !mfaStartData.success) {
        return {
          success: false,
          error: mfaStartData.error || "Login failed",
        };
      }

      if (mfaStartData.requiresMfa) {
        if (mfaStartData.requiresChannelSelection) {
          return {
            success: false,
            requiresMfa: true,
            requiresChannelSelection: true,
            availableChannels: mfaStartData.availableChannels || [],
            destinations: mfaStartData.destinations || {},
          };
        }

        return {
          success: false,
          requiresMfa: true,
          challengeId: mfaStartData.challengeId,
          channel: mfaStartData.channel,
          maskedDestination: mfaStartData.maskedDestination,
        };
      }

      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
        callbackUrl: "/leads",
      });

      if (result?.error) {
        // In some environments, signIn reports a transient client error
        // while the session cookie is already being written.
        if (await hasActiveSession()) {
          return { success: true };
        }

        console.error("SignIn error:", result.error);
        return { success: false, error: "Invalid username or password" };
      }

      // Avoid false negatives caused by short session propagation delays.
      if (!(await hasActiveSession())) {
        return {
          success: false,
          error: "Authentication is taking longer than expected. Please try again.",
        };
      }

      return { success: true };
    } catch (error) {
      console.error("Login failed:", error);

      if (await hasActiveSession()) {
        return { success: true };
      }

      return {
        success: false,
        error: "Unable to connect. Please check your network and try again.",
      };
    }
  };

  const logout = async () => {
    await signOut({
      redirect: false,
    });

    await waitForSessionToClear();
    window.location.href = `${window.location.origin}/auth/login`;
  };

  // Map NextAuth session status to our auth context status
  const status =
    sessionStatus === "loading"
      ? "loading"
      : session
      ? "authenticated"
      : "unauthenticated";

  // Map NextAuth session user to our auth context user
  const user = session?.user || null;

  return (
    <AuthContext.Provider value={{ status, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
