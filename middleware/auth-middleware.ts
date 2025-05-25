import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AccessLevel, Resource, SpecificPermission } from "@/types/auth";
import {
  hasPermissionServer,
  hasRoleServer,
  canAccessServer,
} from "@/lib/authorization";

/**
 * Middleware to check if the user has a specific permission
 * @param permission - The permission to check for
 */
export async function withPermission(
  request: NextRequest,
  permission: SpecificPermission
) {
  const hasPermission = await hasPermissionServer(permission);

  if (!hasPermission) {
    return NextResponse.json(
      { error: "You don't have permission to access this resource" },
      { status: 403 }
    );
  }

  return NextResponse.next();
}

/**
 * Middleware to check if the user has a specific role
 * @param role - The role to check for
 */
export async function withRole(request: NextRequest, role: string) {
  const hasRole = await hasRoleServer(role);

  if (!hasRole) {
    return NextResponse.json(
      { error: "You don't have the required role to access this resource" },
      { status: 403 }
    );
  }

  return NextResponse.next();
}

/**
 * Middleware to check if the user has the required access level for a resource
 * @param resource - The resource to check access for
 * @param requiredLevel - The minimum access level required
 */
export async function withResourceAccess(
  request: NextRequest,
  resource: Resource,
  requiredLevel: AccessLevel
) {
  const canAccess = await canAccessServer(resource, requiredLevel);

  if (!canAccess) {
    return NextResponse.json(
      { error: "You don't have sufficient access to this resource" },
      { status: 403 }
    );
  }

  return NextResponse.next();
}

/**
 * Higher-order function to create a route handler with permission check
 * @param permission - The permission to check for
 * @param handler - The route handler function
 */
export function createPermissionHandler(
  permission: SpecificPermission,
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    const hasPermission = await hasPermissionServer(permission);

    if (!hasPermission) {
      return NextResponse.json(
        { error: "You don't have permission to access this resource" },
        { status: 403 }
      );
    }

    return handler(request);
  };
}

/**
 * Higher-order function to create a route handler with role check
 * @param role - The role to check for
 * @param handler - The route handler function
 */
export function createRoleHandler(
  role: string,
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    const hasRole = await hasRoleServer(role);

    if (!hasRole) {
      return NextResponse.json(
        { error: "You don't have the required role to access this resource" },
        { status: 403 }
      );
    }

    return handler(request);
  };
}

/**
 * Higher-order function to create a route handler with resource access check
 * @param resource - The resource to check access for
 * @param requiredLevel - The minimum access level required
 * @param handler - The route handler function
 */
export function createResourceAccessHandler(
  resource: Resource,
  requiredLevel: AccessLevel,
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    const canAccess = await canAccessServer(resource, requiredLevel);

    if (!canAccess) {
      return NextResponse.json(
        { error: "You don't have sufficient access to this resource" },
        { status: 403 }
      );
    }

    return handler(request);
  };
}
