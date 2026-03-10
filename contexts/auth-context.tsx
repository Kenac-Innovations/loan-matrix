"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";

// Define the shape of our authentication context
type AuthContextType = {
  status: "loading" | "authenticated" | "unauthenticated";
  user: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
};

// Create the context with a default value
const AuthContext = createContext<AuthContextType>({
  status: "loading",
  user: null,
  login: async () => false,
  logout: () => {},
});

// Custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);

// Provider component that wraps the app and makes auth available
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  // Login function that calls NextAuth signIn
  const login = async (username: string, password: string) => {
    try {
      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
        callbackUrl: "/leads",
      });

      if (result?.error) {
        console.error("SignIn error:", result.error);
        // Handle specific NextAuth errors
        if (result.error.includes("CLIENT_FETCH_ERROR")) {
          console.error(
            "NextAuth CLIENT_FETCH_ERROR - Check NEXTAUTH_URL configuration"
          );
        }
        return false;
      }

      return true;
    } catch (error) {
      console.error("Login failed:", error);
      // Handle network or fetch errors
      if (error instanceof Error && error.message.includes("fetch")) {
        console.error(
          "Network error during authentication - check API connectivity"
        );
      }
      return false;
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
