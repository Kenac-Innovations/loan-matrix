import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getSession } from "@/lib/auth";

/**
 * POST /api/tellers/[id]/cashiers/[cashierId]/session/verify
 * Supervisor verifies and approves a closed session
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; cashierId: string }> }
) {
  try {
    const params = await context.params;
    const { id: tellerId, cashierId } = params;
    const tenant = await getTenantFromHeaders();
    const session = await getSession();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { sessionId, approved, comments } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    // Get teller and cashier
    const teller = await prisma.teller.findFirst({
      where: { id: tellerId, tenantId: tenant.id },
    });

    // Try to find cashier by database ID first, then by Fineract ID
    let cashier = await prisma.cashier.findFirst({
      where: { id: cashierId, tellerId, tenantId: tenant.id },
    });

    if (!cashier) {
      const fineractCashierId = parseInt(cashierId);
      if (!isNaN(fineractCashierId)) {
        cashier = await prisma.cashier.findFirst({
          where: {
            fineractCashierId,
            tellerId,
            tenantId: tenant.id,
          },
        });
      }
    }

    if (!teller || !cashier) {
      return NextResponse.json(
        { error: "Teller or cashier not found" },
        { status: 404 }
      );
    }

    // Get the session
    const cashierSession = await prisma.cashierSession.findFirst({
      where: {
        id: sessionId,
        tellerId,
        cashierId: cashier.id,
        tenantId: tenant.id,
      },
    });

    if (!cashierSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (cashierSession.sessionStatus !== "CLOSED") {
      return NextResponse.json(
        { error: "Session must be closed before verification" },
        { status: 400 }
      );
    }

    // Update session with verification
    const updatedSession = await prisma.cashierSession.update({
      where: { id: sessionId },
      data: {
        sessionStatus: approved ? "CLOSED_VERIFIED" : "CLOSED",
        verifiedBy: session.user.id,
        verifiedAt: new Date(),
        comments: comments
          ? `${cashierSession.comments || ""}\n[Verified]: ${comments}`.trim()
          : cashierSession.comments,
      },
    });

    return NextResponse.json(updatedSession);
  } catch (error) {
    console.error("Error verifying session:", error);
    return NextResponse.json(
      {
        error: "Failed to verify session",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

