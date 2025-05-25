/**
 * Server Action to check if the user has a specific permission
 * @param permission - The permission to check for
 * @returns Boolean indicating if the user has the permission
 */

import { getSession } from "@/lib/auth";
import { SpecificPermission } from "@/types/auth";

export async function checkPermission(
  permission: SpecificPermission
): Promise<boolean> {
  const session = await getSession();

  if (!session?.user?.permissions) {
    return false;
  }

  if (session.user.permissions.includes(SpecificPermission.ALL_FUNCTIONS)) {
    return true;
  }

  return session.user.permissions.includes(permission);
}
