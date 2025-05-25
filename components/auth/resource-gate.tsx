"use client";

import { ReactNode } from "react";
import { useCanAccess } from "@/hooks/use-authorization";
import { AccessLevel, Resource } from "@/types/auth";

interface ResourceGateProps {
  resource: Resource;
  requiredLevel: AccessLevel;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Component that conditionally renders children based on user's access level to a resource
 * @param resource - The resource to check access for
 * @param requiredLevel - The minimum access level required
 * @param children - The content to render if the user has the required access level
 * @param fallback - Optional content to render if the user doesn't have the required access level
 */
export function ResourceGate({
  resource,
  requiredLevel,
  children,
  fallback,
}: ResourceGateProps) {
  const canAccess = useCanAccess(resource, requiredLevel);

  if (!canAccess) {
    return fallback || null;
  }

  return <>{children}</>;
}
