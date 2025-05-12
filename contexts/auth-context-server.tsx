"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loginAction, logoutAction } from "@/app/actions/auth";

// Define the shape of our authentication context
type AuthContextType = {
  status: "loading" | "authenticated" | "unauthenticated";
  user: {
    id?: string;
    name?: string;
    email?: string;
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
  const [status, setStatus] = useState<
    "loading" | "authenticated" | "unauthenticated"
  >("loading");
  const [user, setUser] = useState<AuthContextType["user"]>(null);
  const router = useRouter();

  // Check if the user is authenticated on initial load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // We'll use a simple fetch to a protected endpoint to check auth status
        const res = await fetch("/api/auth/session");
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setUser(data.user);
            setStatus("authenticated");
          } else {
            setUser(null);
            setStatus("unauthenticated");
          }
        } else {
          setUser(null);
          setStatus("unauthenticated");
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        setUser(null);
        setStatus("unauthenticated");
      }
    };

    checkAuth();
  }, []);

  // Login function that calls our server action
  const login = async (username: string, password: string) => {
    try {
      const result = await loginAction({ username, password });

      if (result.success) {
        setUser({
          id: username,
          name: username,
          email: `${username}@example.com`, // Placeholder email
        });
        setStatus("authenticated");
        return true;
      } else {
        setUser(null);
        setStatus("unauthenticated");
        return false;
      }
    } catch (error) {
      console.error("Login failed:", error);
      setUser(null);
      setStatus("unauthenticated");
      return false;
    }
  };

  // Logout function that calls our server action
  const logout = () => {
    logoutAction();
    // The server action will handle the redirect, but we'll update the state as well
    setUser(null);
    setStatus("unauthenticated");
  };

  return (
    <AuthContext.Provider value={{ status, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
