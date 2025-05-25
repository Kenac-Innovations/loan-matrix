import { AccessLevel, Resource, SpecificPermission } from "@/types/auth";
import {
  hasPermissionServer,
  hasRoleServer,
  canAccessServer,
} from "./authorization";

/**
 * Higher-order function to create a server action with permission check
 * @param permission - The permission to check for
 * @param action - The server action function
 */
export function withPermissionAction<T, U>(
  permission: SpecificPermission,
  action: (data: T) => Promise<U>
) {
  return async (data: T): Promise<U | { error: string }> => {
    const hasPermission = await hasPermissionServer(permission);

    if (!hasPermission) {
      return { error: "You don't have permission to perform this action" };
    }

    return action(data);
  };
}

/**
 * Higher-order function to create a server action with role check
 * @param role - The role to check for
 * @param action - The server action function
 */
export function withRoleAction<T, U>(
  role: string,
  action: (data: T) => Promise<U>
) {
  return async (data: T): Promise<U | { error: string }> => {
    const hasRole = await hasRoleServer(role);

    if (!hasRole) {
      return {
        error: "You don't have the required role to perform this action",
      };
    }

    return action(data);
  };
}

/**
 * Higher-order function to create a server action with resource access check
 * @param resource - The resource to check access for
 * @param requiredLevel - The minimum access level required
 * @param action - The server action function
 */
export function withResourceAccessAction<T, U>(
  resource: Resource,
  requiredLevel: AccessLevel,
  action: (data: T) => Promise<U>
) {
  return async (data: T): Promise<U | { error: string }> => {
    const canAccess = await canAccessServer(resource, requiredLevel);

    if (!canAccess) {
      return {
        error: "You don't have sufficient access to perform this action",
      };
    }

    return action(data);
  };
}

/**
 * Check if the result of an authorized action contains an error
 * @param result - The result of an authorized action
 * @returns Boolean indicating if the result contains an error
 */
export function isAuthError<T>(
  result: T | { error: string }
): result is { error: string } {
  return (
    typeof result === "object" &&
    result !== null &&
    "error" in result &&
    typeof result.error === "string"
  );
}
