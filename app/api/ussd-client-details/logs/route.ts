import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireUssdClientDetailsAccess,
  UssdClientDetailsAccessError,
} from "@/lib/ussd-client-details-access";

function errorResponse(error: unknown) {
  if (error instanceof UssdClientDetailsAccessError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error("USSD client details log lookup failed:", error);
  return NextResponse.json(
    { error: "Failed to load USSD client update logs" },
    { status: 500 }
  );
}

export async function GET(request: NextRequest) {
  try {
    const access = await requireUssdClientDetailsAccess();
    const { searchParams } = new URL(request.url);
    const requestedLimit = Number(searchParams.get("limit") ?? 25);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 100)
      : 25;

    const logs = await prisma.ussdClientInfoUpdateLog.findMany({
      where: {
        tenantId: access.tenant.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      select: {
        id: true,
        updateType: true,
        sourcePhoneNumber: true,
        requestedPhoneNumber: true,
        ussdUserId: true,
        fineractClientId: true,
        clientName: true,
        actorUserId: true,
        actorName: true,
        status: true,
        ussdStatus: true,
        fineractStatus: true,
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
