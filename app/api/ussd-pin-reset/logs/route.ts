import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireUssdPinResetAccess,
  UssdPinResetAccessError,
} from "@/lib/ussd-pin-reset-access";

function errorResponse(error: unknown) {
  if (error instanceof UssdPinResetAccessError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error("USSD PIN reset log lookup failed:", error);
  return NextResponse.json(
    { error: "Failed to load USSD PIN reset logs" },
    { status: 500 }
  );
}

export async function GET(request: NextRequest) {
  try {
    const access = await requireUssdPinResetAccess();
    const { searchParams } = new URL(request.url);
    const requestedLimit = Number(searchParams.get("limit") ?? 20);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 100)
      : 20;

    const logs = await prisma.ussdPinResetLog.findMany({
      where: {
        tenantId: access.tenant.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      select: {
        id: true,
        phoneNumber: true,
        ussdUserId: true,
        clientName: true,
        nationalIdMask: true,
        actorUserId: true,
        actorName: true,
        reason: true,
        status: true,
        ussdStatus: true,
        responseMessage: true,
        errorMessage: true,
        completedAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      logs: logs.map((log) => ({
        ...log,
        completedAt: log.completedAt?.toISOString() ?? null,
        createdAt: log.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
