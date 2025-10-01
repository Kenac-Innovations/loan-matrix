"use client";

import { useSession } from "next-auth/react";
import { AccessLevel, Resource, SpecificPermission } from "@/types/auth";

/**
 * Client-side React hook to check if the user has a specific permission
 * @param permission - The permission to check for
 * @returns Boolean indicating if the user has the permission
 */
export function usePermission(permission: SpecificPermission): boolean {
  const { data: session, status } = useSession();

  if (status !== "authenticated" || !session?.user?.permissions) {
    return false;
  }

  // Check if the user has the ALL_FUNCTIONS permission
  if (session.user.permissions.includes(SpecificPermission.ALL_FUNCTIONS)) {
    return true;
  }

  // Check if the user has the specific permission
  return session.user.permissions.includes(permission);
}

/**
 * Client-side React hook to check if the user has a specific role
 * @param roleName - The role to check for
 * @returns Boolean indicating if the user has the role
 */
export function useRole(roleName: string): boolean {
  const { data: session, status } = useSession();

  if (status !== "authenticated" || !session?.user?.roles) {
    return false;
  }

  console.log("Roles::", session.user.roles);
  // Check if the user has the role and it's not disabled
  return session.user.roles.some(
    (role) => role.name === roleName && !role.disabled
  );
}

/**
 * Client-side React hook to get the user's access level for a resource
 * @param resource - The resource to check access for
 * @returns The user's access level for the resource
 */
export function useResourceAccessLevel(resource: Resource): AccessLevel {
  const { data: session, status } = useSession();

  if (status !== "authenticated" || !session?.user?.permissions) {
    return AccessLevel.NONE;
  }

  // Check if the user has the ALL_FUNCTIONS permission
  if (session.user.permissions.includes(SpecificPermission.ALL_FUNCTIONS)) {
    return AccessLevel.ADMIN;
  }

  // Map resources to their corresponding permissions
  const resourcePermissions = {
    [Resource.CLIENT]: {
      [AccessLevel.READ]: SpecificPermission.READ_CLIENT,
      [AccessLevel.WRITE]: SpecificPermission.UPDATE_CLIENT,
      [AccessLevel.ADMIN]: SpecificPermission.ALL_FUNCTIONS,
    },
    [Resource.LOAN]: {
      [AccessLevel.READ]: SpecificPermission.READ_LOAN,
      [AccessLevel.WRITE]: SpecificPermission.UPDATE_LOAN,
      [AccessLevel.ADMIN]: SpecificPermission.ALL_FUNCTIONS,
    },
    [Resource.OFFICE]: {
      [AccessLevel.READ]: SpecificPermission.READ_OFFICE,
      [AccessLevel.WRITE]: SpecificPermission.UPDATE_OFFICE,
      [AccessLevel.ADMIN]: SpecificPermission.ALL_FUNCTIONS,
    },
    [Resource.USER]: {
      [AccessLevel.READ]: SpecificPermission.READ_USER,
      [AccessLevel.WRITE]: SpecificPermission.UPDATE_USER,
      [AccessLevel.ADMIN]: SpecificPermission.ALL_FUNCTIONS,
    },
    [Resource.SYSTEM]: {
      [AccessLevel.READ]: SpecificPermission.SYSTEM_ADMIN,
      [AccessLevel.WRITE]: SpecificPermission.SYSTEM_ADMIN,
      [AccessLevel.ADMIN]: SpecificPermission.SYSTEM_ADMIN,
    },
  };

  // Check for ADMIN access
  if (
    session.user.permissions.includes(
      resourcePermissions[resource][AccessLevel.ADMIN]
    )
  ) {
    return AccessLevel.ADMIN;
  }

  // Check for WRITE access
  if (
    session.user.permissions.includes(
      resourcePermissions[resource][AccessLevel.WRITE]
    )
  ) {
    return AccessLevel.WRITE;
  }

  // Check for READ access
  if (
    session.user.permissions.includes(
      resourcePermissions[resource][AccessLevel.READ]
    )
  ) {
    return AccessLevel.READ;
  }

  return AccessLevel.NONE;
}

/**
 * Client-side React hook to check if the user can perform a specific action on a resource
 * @param resource - The resource to check access for
 * @param requiredLevel - The minimum access level required
 * @returns Boolean indicating if the user has the required access level
 */
export function useCanAccess(
  resource: Resource,
  requiredLevel: AccessLevel
): boolean {
  const userAccessLevel = useResourceAccessLevel(resource);

  // Map access levels to numeric values for comparison
  const accessLevelValues = {
    [AccessLevel.NONE]: 0,
    [AccessLevel.READ]: 1,
    [AccessLevel.WRITE]: 2,
    [AccessLevel.ADMIN]: 3,
  };

  return accessLevelValues[userAccessLevel] >= accessLevelValues[requiredLevel];
}
