import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getFineractTenantId } from "@/lib/fineract-tenant-service";

/**
 * GET /api/alerts/[id]
 * Get a specific alert
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session?.user?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const mifosUserId = session.user.userId;
    const fineractTenantId = await getFineractTenantId();

    // Get tenant
    const tenant = await prisma.tenant.findFirst({
      where: { slug: fineractTenantId },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Fetch alert ensuring it belongs to the current user
    const alert = await prisma.alert.findFirst({
      where: {
        id,
        tenantId: tenant.id,
        mifosUserId: mifosUserId,
      },
    });

    if (!alert) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    return NextResponse.json({ alert });
  } catch (error: any) {
    console.error("Error fetching alert:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch alert" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/alerts/[id]
 * Update a specific alert (mark as read/dismissed)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session?.user?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const mifosUserId = session.user.userId;
    const fineractTenantId = await getFineractTenantId();

    // Get tenant
    const tenant = await prisma.tenant.findFirst({
      where: { slug: fineractTenantId },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Verify alert belongs to user
    const existingAlert = await prisma.alert.findFirst({
      where: {
        id,
        tenantId: tenant.id,
        mifosUserId: mifosUserId,
      },
    });

    if (!existingAlert) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    const body = await request.json();
    const { isRead, isDismissed } = body;

    // Update alert
    const alert = await prisma.alert.update({
      where: { id },
      data: {
        ...(typeof isRead === "boolean" && { isRead }),
        ...(typeof isDismissed === "boolean" && { isDismissed }),
      },
    });

    return NextResponse.json({
      success: true,
      alert,
    });
  } catch (error: any) {
    console.error("Error updating alert:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update alert" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/alerts/[id]
 * Delete a specific alert (admin only - or mark as dismissed)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session?.user?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const mifosUserId = session.user.userId;
    const fineractTenantId = await getFineractTenantId();

    // Get tenant
    const tenant = await prisma.tenant.findFirst({
      where: { slug: fineractTenantId },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Verify alert belongs to user
    const existingAlert = await prisma.alert.findFirst({
      where: {
        id,
        tenantId: tenant.id,
        mifosUserId: mifosUserId,
      },
    });

    if (!existingAlert) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    // Mark as dismissed instead of deleting (soft delete)
    const alert = await prisma.alert.update({
      where: { id },
      data: { isDismissed: true },
    });

    return NextResponse.json({
      success: true,
      message: "Alert dismissed",
    });
  } catch (error: any) {
    console.error("Error dismissing alert:", error);
    return NextResponse.json(
      { error: error.message || "Failed to dismiss alert" },
      { status: 500 }
    );
  }
}
