import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getFineractTenantId } from "@/lib/fineract-tenant-service";
import { AlertType } from "@/app/generated/prisma";

/**
 * GET /api/alerts
 * Get alerts for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.user?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const mifosUserId = session.user.userId;
    const fineractTenantId = await getFineractTenantId();

    // Get tenant
    const tenant = await prisma.tenant.findFirst({
      where: { slug: fineractTenantId },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const includeRead = searchParams.get("includeRead") === "true";
    const includeDismissed = searchParams.get("includeDismissed") === "true";
    const type = searchParams.get("type") as AlertType | null;
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    // Build where clause
    const where: any = {
      tenantId: tenant.id,
      mifosUserId: mifosUserId,
      // Filter out expired alerts
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    };

    if (!includeRead) {
      where.isRead = false;
    }

    if (!includeDismissed) {
      where.isDismissed = false;
    }

    if (type) {
      where.type = type;
    }

    // Fetch alerts
    const alerts = await prisma.alert.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // Get unread count
    const unreadCount = await prisma.alert.count({
      where: {
        tenantId: tenant.id,
        mifosUserId: mifosUserId,
        isRead: false,
        isDismissed: false,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    return NextResponse.json({
      alerts,
      unreadCount,
      total: alerts.length,
    });
  } catch (error: any) {
    console.error("Error fetching alerts:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch alerts" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/alerts
 * Create a new alert for a user
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.user?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const fineractTenantId = await getFineractTenantId();

    // Get tenant
    const tenant = await prisma.tenant.findFirst({
      where: { slug: fineractTenantId },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      mifosUserId,
      type = "INFO",
      title,
      message,
      actionUrl,
      actionLabel,
      metadata,
      expiresAt,
    } = body;

    // Validate required fields
    if (!mifosUserId) {
      return NextResponse.json(
        { error: "mifosUserId is required" },
        { status: 400 }
      );
    }

    if (!title || !message) {
      return NextResponse.json(
        { error: "title and message are required" },
        { status: 400 }
      );
    }

    // Create the alert
    const alert = await prisma.alert.create({
      data: {
        tenantId: tenant.id,
        mifosUserId: parseInt(mifosUserId, 10),
        type: type as AlertType,
        title,
        message,
        actionUrl,
        actionLabel,
        metadata,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdBy: session.user.name || `user_${session.user.userId}`,
      },
    });

    return NextResponse.json({
      success: true,
      alert,
    });
  } catch (error: any) {
    console.error("Error creating alert:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create alert" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/alerts
 * Mark alerts as read/dismissed (bulk operation)
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.user?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const mifosUserId = session.user.userId;
    const fineractTenantId = await getFineractTenantId();

    // Get tenant
    const tenant = await prisma.tenant.findFirst({
      where: { slug: fineractTenantId },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const body = await request.json();
    const { alertIds, action } = body; // action: 'read' | 'dismiss' | 'readAll'

    if (action === "readAll") {
      // Mark all unread alerts as read for this user
      const result = await prisma.alert.updateMany({
        where: {
          tenantId: tenant.id,
          mifosUserId: mifosUserId,
          isRead: false,
          isDismissed: false,
        },
        data: {
          isRead: true,
        },
      });

      return NextResponse.json({
        success: true,
        updated: result.count,
      });
    }

    if (!alertIds || !Array.isArray(alertIds) || alertIds.length === 0) {
      return NextResponse.json(
        { error: "alertIds array is required" },
        { status: 400 }
      );
    }

    if (!action || !["read", "dismiss"].includes(action)) {
      return NextResponse.json(
        { error: "action must be 'read' or 'dismiss'" },
        { status: 400 }
      );
    }

    // Update alerts
    const updateData =
      action === "read" ? { isRead: true } : { isDismissed: true };

    const result = await prisma.alert.updateMany({
      where: {
        id: { in: alertIds },
        tenantId: tenant.id,
        mifosUserId: mifosUserId,
      },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      updated: result.count,
    });
  } catch (error: any) {
    console.error("Error updating alerts:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update alerts" },
      { status: 500 }
    );
  }
}
