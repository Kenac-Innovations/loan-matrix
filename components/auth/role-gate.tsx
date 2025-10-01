"use client";

import { ReactNode } from "react";
import { useRole } from "@/hooks/use-client-auth";

interface RoleGateProps {
  role: string;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Component that conditionally renders children based on user roles
 * @param role - The role required to view the children
 * @param children - The content to render if the user has the role
 * @param fallback - Optional content to render if the user doesn't have the role
 */
export function RoleGate({ role, children, fallback }: RoleGateProps) {
  const hasRole = useRole(role);

  if (!hasRole) {
    return fallback || null;
  }

  return <>{children}</>;
}
