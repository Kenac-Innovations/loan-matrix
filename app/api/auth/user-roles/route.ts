import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFineractTenantId } from "@/lib/fineract-tenant-service";

/**
 * GET /api/auth/user-roles
 * Returns the current user's roles for role-based access control
 */
export async function GET() {
  try {
    const session = await getSession();
    
    if (!session?.user?.userId) {
      return NextResponse.json(
        { roles: [], isAdmin: false, isSuperAdmin: false },
        { status: 200 }
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
        { roles: [], isAdmin: false, isSuperAdmin: false },
        { status: 200 }
      );
    }

    // Get user's roles from local DB
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

    // Extract role names
    const roles = userRoles.map((ur) => ur.role.name);

    // Check for admin/super admin
    // For now, we consider "mifos" user as super admin and users with certain Fineract permissions as admins
    const isSuperAdmin = session.user.name === "mifos" || roles.includes("SUPER_ADMIN");
    const isAdmin = isSuperAdmin || roles.includes("ADMIN") || roles.includes("BRANCH_MANAGER");

    return NextResponse.json({
      roles,
      isAdmin,
      isSuperAdmin,
    });
  } catch (error) {
    console.error("Error fetching user roles:", error);
    return NextResponse.json(
      { roles: [], isAdmin: false, isSuperAdmin: false },
      { status: 200 }
    );
  }
}
