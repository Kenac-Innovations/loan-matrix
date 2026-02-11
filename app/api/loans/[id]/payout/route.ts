import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getSession } from "@/lib/auth";
import { getFineractServiceWithSession } from "@/lib/fineract-api";

/**
 * GET /api/loans/[id]/payout
 * Get the payout status for a specific loan
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id } = params;
    const tenant = await getTenantFromHeaders();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const fineractLoanId = parseInt(id);
    if (isNaN(fineractLoanId)) {
      return NextResponse.json({ error: "Invalid loan ID" }, { status: 400 });
    }

    console.log(`Fetching payout for loan ${fineractLoanId}, tenant ${tenant.id}`);

    const payout = await prisma.loanPayout.findUnique({
      where: {
        tenantId_fineractLoanId: {
          tenantId: tenant.id,
          fineractLoanId,
        },
      },
    });

    let disbursementPaymentType: {
      id: number | null;
      name: string | null;
      isCash?: boolean;
    } | null = null;

    try {
      const fineractService = await getFineractServiceWithSession();
      const transactions = await fineractService.getLoanTransactions(
        fineractLoanId
      );
      const disburseTxn = transactions.find(
        (t) => t.type?.disbursement && !t.manuallyReversed
      );
      if (disburseTxn?.paymentDetailData?.paymentType) {
        disbursementPaymentType = {
          id: disburseTxn.paymentDetailData.paymentType.id,
          name: disburseTxn.paymentDetailData.paymentType.name,
        };
      }
    } catch (error) {
      console.error(
        "Error fetching disbursement payment type for payout:",
        error
      );
    }

    console.log(`Payout lookup result:`, payout ? { id: payout.id, status: payout.status } : "Not found");

    if (!payout) {
      return NextResponse.json({
        status: "PENDING",
        message: "No payout record found - loan is pending payout",
        disbursementPaymentType,
      });
    }

    return NextResponse.json({
      ...payout,
      disbursementPaymentType,
    });
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
 * POST /api/loans/[id]/payout
 * Void a payout (reverse a disbursement)
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id } = params;
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

    const fineractLoanId = parseInt(id);
    if (isNaN(fineractLoanId)) {
      return NextResponse.json({ error: "Invalid loan ID" }, { status: 400 });
    }

    let payout = await prisma.loanPayout.findUnique({
      where: {
        tenantId_fineractLoanId: {
          tenantId: tenant.id,
          fineractLoanId,
        },
      },
    });

    // For markPaid action, create the payout record if it doesn't exist
    if (!payout && action === "markPaid") {
      try {
        const fineractService = await getFineractServiceWithSession();
        const loanDetails = await fineractService.getLoan(fineractLoanId);

        if (loanDetails) {
          payout = await prisma.loanPayout.create({
            data: {
              tenantId: tenant.id,
              fineractLoanId: loanDetails.id,
              fineractClientId: loanDetails.clientId,
              clientName: loanDetails.clientName || "Unknown Client",
              loanAccountNo: loanDetails.accountNo || "",
              amount:
                loanDetails.principal ||
                loanDetails.approvedPrincipal ||
                0,
              currency: loanDetails.currency?.code || "ZMW",
              status: "PENDING",
            },
          });
        }
      } catch (fetchError) {
        console.error("Error creating payout record from Fineract:", fetchError);
      }
    }

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

    // Mark payout as paid for non-cash payment methods (Mobile Money, Bank Transfer)
    if (action === "markPaid") {
      const { paymentMethod, notes: payoutNotes } = body;

      if (!paymentMethod || !["MOBILE_MONEY", "BANK_TRANSFER"].includes(paymentMethod)) {
        return NextResponse.json(
          { error: "Invalid payment method. Use 'MOBILE_MONEY' or 'BANK_TRANSFER'" },
          { status: 400 }
        );
      }

      if (payout.status === "PAID") {
        return NextResponse.json(
          { error: "This loan has already been paid out" },
          { status: 400 }
        );
      }

      if (payout.status === "VOIDED") {
        return NextResponse.json(
          { error: "This loan payout has been voided" },
          { status: 400 }
        );
      }

      const updatedPayout = await prisma.loanPayout.update({
        where: { id: payout.id },
        data: {
          status: "PAID",
          paymentMethod,
          paidAt: new Date(),
          paidBy: session.user.id,
          notes: payoutNotes || `Paid via ${paymentMethod === "MOBILE_MONEY" ? "Mobile Money" : "Bank Transfer"}`,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Payout marked as paid via ${paymentMethod === "MOBILE_MONEY" ? "Mobile Money" : "Bank Transfer"}`,
        payout: updatedPayout,
      });
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'void' or 'markPaid'" },
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
