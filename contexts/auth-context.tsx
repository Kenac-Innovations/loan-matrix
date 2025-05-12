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
      });

      return !result?.error;
    } catch (error) {
      console.error("Login failed:", error);
      return false;
    }
  };

  // Logout function that calls NextAuth signOut
  const logout = () => {
    signOut({ callbackUrl: "/auth/login" });
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
