import { ReactNode } from "react";
import { SpecificPermission } from "@/types/auth";
import { checkPermission } from "@/app/actions/authorization";

interface PermissionGateProps {
  permission: SpecificPermission;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Component that conditionally renders children based on user permissions
 * @param permission - The permission required to view the children
 * @param children - The content to render if the user has the permission
 * @param fallback - Optional content to render if the user doesn't have the permission
 */
export async function PermissionGate({
  permission,
  children,
  fallback,
}: Readonly<PermissionGateProps>) {
  const hasPermission = await checkPermission(permission);

  if (!hasPermission) {
    return fallback || null;
  }

  return <>{children}</>;
}
