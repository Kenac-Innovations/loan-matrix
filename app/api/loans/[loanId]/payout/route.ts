import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getSession } from "@/lib/auth";

/**
 * GET /api/loans/[loanId]/payout
 * Get the payout status for a specific loan
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ loanId: string }> }
) {
  try {
    const params = await context.params;
    const { loanId } = params;
    const tenant = await getTenantFromHeaders();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const fineractLoanId = parseInt(loanId);
    if (isNaN(fineractLoanId)) {
      return NextResponse.json({ error: "Invalid loan ID" }, { status: 400 });
    }

    const payout = await prisma.loanPayout.findUnique({
      where: {
        tenantId_fineractLoanId: {
          tenantId: tenant.id,
          fineractLoanId,
        },
      },
    });

    if (!payout) {
      return NextResponse.json({
        status: "PENDING",
        message: "No payout record found - loan is pending payout",
      });
    }

    return NextResponse.json(payout);
  } catch (error) {
    console.error("Error fetching payout:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch payout",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/loans/[loanId]/payout
 * Void a payout (reverse a disbursement)
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ loanId: string }> }
) {
  try {
    const params = await context.params;
    const { loanId } = params;
    const tenant = await getTenantFromHeaders();
    const session = await getSession();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, reason } = body;

    const fineractLoanId = parseInt(loanId);
    if (isNaN(fineractLoanId)) {
      return NextResponse.json({ error: "Invalid loan ID" }, { status: 400 });
    }

    const payout = await prisma.loanPayout.findUnique({
      where: {
        tenantId_fineractLoanId: {
          tenantId: tenant.id,
          fineractLoanId,
        },
      },
    });

    if (!payout) {
      return NextResponse.json(
        { error: "Payout record not found" },
        { status: 404 }
      );
    }

    if (action === "void") {
      if (payout.status !== "PAID") {
        return NextResponse.json(
          { error: "Can only void a paid payout" },
          { status: 400 }
        );
      }

      if (!reason) {
        return NextResponse.json(
          { error: "Reason is required for voiding a payout" },
          { status: 400 }
        );
      }

      // Void the payout
      const updatedPayout = await prisma.loanPayout.update({
        where: { id: payout.id },
        data: {
          status: "VOIDED",
          voidedAt: new Date(),
          voidedBy: session.user.id,
          voidReason: reason,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Payout voided successfully",
        payout: updatedPayout,
      });
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'void' to void a payout" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error processing payout action:", error);
    return NextResponse.json(
      {
        error: "Failed to process payout action",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
