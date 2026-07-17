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
        {
          roles: [],
          isAdmin: false,
          isSuperAdmin: false,
          canConfirmPayments: false,
          canResetUssdPin: false,
        },
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
        {
          roles: [],
          isAdmin: false,
          isSuperAdmin: false,
          canConfirmPayments: false,
          canResetUssdPin: false,
        },
        { status: 200 }
      );
    }

    const [userRoles, userLogin] = await Promise.all([
      prisma.userRole.findMany({
        where: {
          tenantId: tenant.id,
          mifosUserId: mifosUserId,
          isActive: true,
        },
        include: {
          role: true,
        },
      }),
      prisma.userLogin.findUnique({
        where: {
          tenantId_fineractUserId: {
            tenantId: tenant.id,
            fineractUserId: mifosUserId,
          },
        },
        select: {
          canConfirmPayments: true,
          canResetUssdPin: true,
        },
      }),
    ]);

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
      canConfirmPayments: userLogin?.canConfirmPayments ?? false,
      canResetUssdPin: isSuperAdmin || Boolean(userLogin?.canResetUssdPin),
    });
  } catch (error) {
    console.error("Error fetching user roles:", error);
    return NextResponse.json(
      {
        roles: [],
        isAdmin: false,
        isSuperAdmin: false,
        canConfirmPayments: false,
        canResetUssdPin: false,
      },
      { status: 200 }
    );
  }
}
