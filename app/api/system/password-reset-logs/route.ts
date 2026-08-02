import { NextRequest, NextResponse } from "next/server";
import { SpecificPermission } from "@/shared/types/auth";
import { hasPermissionServer } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { requireCurrentTenant } from "@/lib/user-login-service";

export async function GET(request: NextRequest) {
  try {
    const canReadUsers = await hasPermissionServer(SpecificPermission.READ_USER);
    const canManageSystem = await hasPermissionServer(SpecificPermission.SYSTEM_ADMIN);

    if (!canReadUsers && !canManageSystem) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const tenant = await requireCurrentTenant();
    const searchParams = request.nextUrl.searchParams;
    const requestedLimit = Number(searchParams.get("limit") || 50);
    const requestedOffset = Number(searchParams.get("offset") || 0);
    const limit = Math.min(
      Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 50, 1),
      100
    );
    const offset = Math.max(
      Number.isFinite(requestedOffset) ? requestedOffset : 0,
      0
    );
    const username = searchParams.get("username")?.trim();
    const event = searchParams.get("event")?.trim();

    const where = {
      tenantId: tenant.id,
      ...(username ? { username: { contains: username, mode: "insensitive" as const } } : {}),
      ...(event ? { event } : {}),
    };

    const [total, logs] = await Promise.all([
      prisma.passwordResetLog.count({ where }),
      prisma.passwordResetLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      total,
      offset,
      limit,
      logs,
    });
  } catch (error) {
    console.error("Error fetching password reset logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch password reset logs" },
      { status: 500 }
    );
  }
}
