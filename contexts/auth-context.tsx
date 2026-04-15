"use client";

import React, { createContext, useContext } from "react";
import { signIn, signOut, useSession, getSession } from "next-auth/react";

type LoginResult = { success: boolean; error?: string };

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
    callbackUrl?: string
  ) => Promise<LoginResult>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType>({
  status: "loading",
  user: null,
  login: async () => ({ success: false }),
  logout: () => {},
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

  const login = async (
    username: string,
    password: string,
    callbackUrl = "/leads"
  ): Promise<LoginResult> => {
    try {
      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        // In some environments, signIn reports a transient client error
        // while the session cookie is already being written.
        if (await hasActiveSession()) {
          return { success: true };
        }

        console.error("SignIn error:", result.error);

        try {
          const validateRes = await fetch("/api/auth/validate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
          });
          const validateData = await validateRes.json();

          if (!validateRes.ok || !validateData.success) {
            return {
              success: false,
              error: validateData.error || "Invalid username or password",
            };
          }
        } catch {
          // validate endpoint unreachable, fall through to generic error
        }

        return { success: false, error: "Invalid username or password" };
      }

      // Avoid false negatives caused by short session propagation delays.
      if (!(await hasActiveSession())) {
        return {
          success: false,
          error: "Authentication is taking longer than expected. Please try again.",
        };
      }

      try {
        const validateRes = await fetch("/api/auth/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        const validateData = await validateRes.json();

        if (!validateRes.ok || !validateData.success) {
          await signOut({ redirect: false });
          return {
            success: false,
            error: validateData.error || "Authentication failed",
          };
        }
      } catch {
        // validate endpoint unreachable — signIn already succeeded so allow login
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

  const logout = () => {
    signOut({
      callbackUrl: `${window.location.origin}/auth/login`,
    });
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
