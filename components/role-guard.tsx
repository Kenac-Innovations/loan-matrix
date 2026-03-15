"use client";

import { useEffect, useState, ReactNode } from "react";

/**
 * System roles that can be used to guard components
 */
export type SystemRoleName =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "BRANCH_MANAGER"
  | "LOAN_OFFICER"
  | "CREDIT_OFFICER"
  | "ACCOUNTANT"
  | "AUTHORISER"
  | "AUTHORISER2"
  | "COMPLIANCE";

interface RoleGuardProps {
  /** The content to render if the user has the required role */
  children: ReactNode;
  /** List of roles that are allowed to see this content */
  allowedRoles: SystemRoleName[];
  /** Optional fallback content to render if the user doesn't have the required role */
  fallback?: ReactNode;
}

interface UserRoleResponse {
  roles: string[];
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

/**
 * RoleGuard - A reusable component to conditionally render content based on user roles
 * 
 * Usage:
 * ```tsx
 * <RoleGuard allowedRoles={["ADMIN", "SUPER_ADMIN"]}>
 *   <SecretAdminContent />
 * </RoleGuard>
 * ```
 */
export function RoleGuard({ children, allowedRoles, fallback = null }: RoleGuardProps) {
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkRole() {
      try {
        const response = await fetch("/api/auth/user-roles");
        if (!response.ok) {
          setHasAccess(false);
          return;
        }

        const data: UserRoleResponse = await response.json();

        // Super admins and admins always have access if those roles are in allowedRoles
        if (data.isSuperAdmin && allowedRoles.includes("SUPER_ADMIN")) {
          setHasAccess(true);
          return;
        }

        if (data.isAdmin && allowedRoles.includes("ADMIN")) {
          setHasAccess(true);
          return;
        }

        // Check if user has any of the allowed roles
        const userHasAllowedRole = data.roles.some((role) =>
          allowedRoles.includes(role as SystemRoleName)
        );

        setHasAccess(userHasAllowedRole || data.isSuperAdmin || data.isAdmin);
      } catch (error) {
        console.error("Error checking user roles:", error);
        setHasAccess(false);
      } finally {
        setIsLoading(false);
      }
    }

    checkRole();
  }, [allowedRoles]);

  // Don't render anything while loading to prevent flash
  if (isLoading || hasAccess === null) {
    return null;
  }

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * Hook to check if the current user has specific roles
 * Useful when you need role information outside of JSX
 */
export function useUserRoles() {
  const [roles, setRoles] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchRoles() {
      try {
        const response = await fetch("/api/auth/user-roles");
        if (!response.ok) {
          return;
        }

        const data: UserRoleResponse = await response.json();
        setRoles(data.roles);
        setIsAdmin(data.isAdmin);
        setIsSuperAdmin(data.isSuperAdmin);
      } catch (error) {
        console.error("Error fetching user roles:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchRoles();
  }, []);

  const hasRole = (role: SystemRoleName): boolean => {
    if (isSuperAdmin) return true;
    return roles.includes(role);
  };

  const hasAnyRole = (checkRoles: SystemRoleName[]): boolean => {
    if (isSuperAdmin) return true;
    if (isAdmin && checkRoles.includes("ADMIN")) return true;
    return checkRoles.some((role) => roles.includes(role));
  };

  return {
    roles,
    isAdmin,
    isSuperAdmin,
    isLoading,
    hasRole,
    hasAnyRole,
  };
}

export default RoleGuard;
