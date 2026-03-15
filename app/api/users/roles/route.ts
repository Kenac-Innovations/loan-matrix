import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getFineractTenantId } from "@/lib/fineract-tenant-service";

/**
 * GET /api/users/roles
 * Get roles for the current user from local database
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session?.user?.userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const mifosUserId = session.user.userId;
    const fineractTenantId = await getFineractTenantId();

    // Get tenant
    const tenant = await prisma.tenant.findFirst({
      where: { slug: fineractTenantId },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 404 }
      );
    }

    // Get user roles from local database
    const userRoles = await prisma.userRole.findMany({
      where: {
        tenantId: tenant.id,
        mifosUserId: mifosUserId,
        isActive: true,
      },
      include: {
        role: true,
      },
    });

    // Format the response
    const roles = userRoles.map((ur) => ({
      id: ur.role.id,
      name: ur.role.name,
      displayName: ur.role.displayName,
      description: ur.role.description,
      permissions: ur.role.permissions,
      assignedAt: ur.assignedAt,
      assignedBy: ur.assignedBy,
    }));

    return NextResponse.json({
      mifosUserId,
      roles,
      totalRoles: roles.length,
    });
  } catch (error: any) {
    console.error("Error fetching user roles:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch user roles" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/users/roles
 * Assign a role to a user
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session?.user?.userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { mifosUserId, mifosUsername, roleId } = body;

    if (!mifosUserId || !roleId) {
      return NextResponse.json(
        { error: "mifosUserId and roleId are required" },
        { status: 400 }
      );
    }

    const fineractTenantId = await getFineractTenantId();

    // Get tenant
    const tenant = await prisma.tenant.findFirst({
      where: { slug: fineractTenantId },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 404 }
      );
    }

    // Check if role exists
    const role = await prisma.systemRole.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      return NextResponse.json(
        { error: "Role not found" },
        { status: 404 }
      );
    }

    // Create user role assignment
    const userRole = await prisma.userRole.upsert({
      where: {
        tenantId_mifosUserId_roleId: {
          tenantId: tenant.id,
          mifosUserId: mifosUserId,
          roleId: roleId,
        },
      },
      update: {
        isActive: true,
        assignedBy: session.user.name || "System",
        assignedAt: new Date(),
      },
      create: {
        tenantId: tenant.id,
        mifosUserId: mifosUserId,
        mifosUsername: mifosUsername || `user_${mifosUserId}`,
        roleId: roleId,
        assignedBy: session.user.name || "System",
        isActive: true,
      },
      include: {
        role: true,
      },
    });

    return NextResponse.json({
      success: true,
      userRole: {
        id: userRole.id,
        role: {
          id: userRole.role.id,
          name: userRole.role.name,
          displayName: userRole.role.displayName,
        },
        assignedAt: userRole.assignedAt,
      },
    });
  } catch (error: any) {
    console.error("Error assigning user role:", error);
    return NextResponse.json(
      { error: error.message || "Failed to assign role" },
      { status: 500 }
    );
  }
}
