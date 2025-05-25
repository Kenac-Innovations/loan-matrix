import { getSession } from "./auth";
import { AccessLevel, Resource, SpecificPermission } from "@/types/auth";

/**
 * Map API permissions to our specific permissions
 * @param apiPermissions - The permissions from the API
 * @returns Array of specific permissions
 */
export function mapApiPermissionsToSpecific(
  apiPermissions: string[]
): SpecificPermission[] {
  const permissionMap: Record<string, SpecificPermission> = {
    // Client permissions
    CREATE_CLIENT: SpecificPermission.CREATE_CLIENT,
    READ_CLIENT: SpecificPermission.READ_CLIENT,
    UPDATE_CLIENT: SpecificPermission.UPDATE_CLIENT,
    DELETE_CLIENT: SpecificPermission.DELETE_CLIENT,

    // Loan permissions
    CREATE_LOAN: SpecificPermission.CREATE_LOAN,
    READ_LOAN: SpecificPermission.READ_LOAN,
    UPDATE_LOAN: SpecificPermission.UPDATE_LOAN,
    DELETE_LOAN: SpecificPermission.DELETE_LOAN,
    APPROVE_LOAN: SpecificPermission.APPROVE_LOAN,
    REJECT_LOAN: SpecificPermission.REJECT_LOAN,
    DISBURSE_LOAN: SpecificPermission.DISBURSE_LOAN,

    // Office permissions
    READ_OFFICE: SpecificPermission.READ_OFFICE,
    CREATE_OFFICE: SpecificPermission.CREATE_OFFICE,
    UPDATE_OFFICE: SpecificPermission.UPDATE_OFFICE,

    // User permissions
    CREATE_USER: SpecificPermission.CREATE_USER,
    READ_USER: SpecificPermission.READ_USER,
    UPDATE_USER: SpecificPermission.UPDATE_USER,
    DELETE_USER: SpecificPermission.DELETE_USER,

    // System permissions
    SYSTEM_ADMIN: SpecificPermission.SYSTEM_ADMIN,

    // Special permissions
    ALL_FUNCTIONS: SpecificPermission.ALL_FUNCTIONS,
  };

  // Map API permissions to our specific permissions
  const specificPermissions = apiPermissions
    .map((permission) => {
      // Check if the permission exists in our map
      if (permissionMap[permission]) {
        return permissionMap[permission];
      }

      // Check if it's a wildcard permission like "ALL_LOAN_FUNCTIONS"
      if (permission.includes("ALL_") && permission.includes("_FUNCTIONS")) {
        // Map to ALL_FUNCTIONS for now, but could be more granular in the future
        return SpecificPermission.ALL_FUNCTIONS;
      }

      return null;
    })
    .filter(
      (permission): permission is SpecificPermission => permission !== null
    );

  // Deduplicate permissions
  return Array.from(new Set(specificPermissions));
}

/**
 * Check if the user has a specific permission
 * @param permission - The permission to check for
 * @returns Promise with boolean indicating if the user has the permission
 */
export async function hasPermissionServer(
  permission: SpecificPermission
): Promise<boolean> {
  const session = await getSession();

  if (!session?.user?.permissions) {
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
 * Check if the user has a specific role
 * @param roleName - The role to check for
 * @returns Promise with boolean indicating if the user has the role
 */
export async function hasRoleServer(roleName: string): Promise<boolean> {
  const session = await getSession();

  if (!session?.user?.roles) {
    return false;
  }

  // Check if the user has the role and it's not disabled
  return session.user.roles.some(
    (role) => role.name === roleName && !role.disabled
  );
}

/**
 * Get the user's access level for a resource
 * @param resource - The resource to check access for
 * @returns Promise with the user's access level for the resource
 */
export async function getResourceAccessLevelServer(
  resource: Resource
): Promise<AccessLevel> {
  const session = await getSession();

  if (!session?.user?.permissions) {
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
 * Check if the user can perform a specific action on a resource
 * @param resource - The resource to check access for
 * @param requiredLevel - The minimum access level required
 * @returns Promise with boolean indicating if the user has the required access level
 */
export async function canAccessServer(
  resource: Resource,
  requiredLevel: AccessLevel
): Promise<boolean> {
  const userAccessLevel = await getResourceAccessLevelServer(resource);

  // Map access levels to numeric values for comparison
  const accessLevelValues = {
    [AccessLevel.NONE]: 0,
    [AccessLevel.READ]: 1,
    [AccessLevel.WRITE]: 2,
    [AccessLevel.ADMIN]: 3,
  };

  return accessLevelValues[userAccessLevel] >= accessLevelValues[requiredLevel];
}
