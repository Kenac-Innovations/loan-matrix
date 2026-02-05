import { NextRequest, NextResponse } from "next/server";
import { getLeadsData } from "@/app/actions/leads-actions";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFineractTenantId } from "@/lib/fineract-tenant-service";

// Check if user has Loan Officer role (sees their created and assigned leads)
async function getUserRoleFilter(): Promise<{ isLoanOfficer: boolean; userId: number | null; userIdString: string | null }> {
  try {
    const session = await getSession();
    if (!session?.user?.userId) {
      return { isLoanOfficer: false, userId: null, userIdString: null };
    }

    const mifosUserId = session.user.userId;
    const mifosUserIdString = mifosUserId.toString();
    const fineractTenantId = await getFineractTenantId();

    // Get tenant
    const tenant = await prisma.tenant.findFirst({
      where: { slug: fineractTenantId },
    });

    if (!tenant) {
      return { isLoanOfficer: false, userId: null, userIdString: null };
    }

    // Check if user has Loan Officer role in local DB
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

    // Check if any role is "LOAN_OFFICER"
    const isLoanOfficer = userRoles.some(
      (ur) => ur.role.name === "LOAN_OFFICER"
    );

    return { isLoanOfficer, userId: mifosUserId, userIdString: mifosUserIdString };
  } catch (error) {
    console.error("Error checking user role:", error);
    return { isLoanOfficer: false, userId: null, userIdString: null };
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantSlug = request.headers.get("x-tenant-slug") || "goodfellow";

    const stage = searchParams.get("stage") || undefined;
    const status = searchParams.get("status") || undefined;
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = parseInt(searchParams.get("offset") || "0");
    const skipFineractStatus = searchParams.get("skipFineractStatus") === "true";
    const search = searchParams.get("search") || undefined;
    const leadStatus = searchParams.get("leadStatus") || undefined;

    // Check if user is a Loan Officer (sees their created and assigned leads)
    const { isLoanOfficer, userId, userIdString } = await getUserRoleFilter();

    const leadsData = await getLeadsData(tenantSlug, {
      stage,
      status,
      limit,
      offset,
      skipFineractStatus,
      search,
      leadStatus,
      // Loan officers see leads they created OR leads assigned to them
      ...(isLoanOfficer && userId && userIdString
        ? { loanOfficerFilter: { oderId: userId, userIdString } }
        : {}),
    });

    return NextResponse.json(leadsData);
  } catch (error) {
    console.error("Error fetching paginated leads:", error);
    return NextResponse.json(
      { error: "Failed to fetch leads" },
      { status: 500 }
    );
  }
}
