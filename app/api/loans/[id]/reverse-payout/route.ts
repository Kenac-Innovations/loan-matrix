import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { prisma } from "@/lib/prisma";

/** POST: Reverse cash payout only (not disbursement). Money returns to cashier. */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenant = await getTenantFromHeaders();
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const { id: loanIdParam } = await context.params;
    const fineractLoanId = parseInt(loanIdParam, 10);
    if (isNaN(fineractLoanId)) {
      return NextResponse.json({ error: "Invalid loan ID" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const reversedBy =
      (body.reversedBy as string)?.trim() ||
      session.user.name ||
      session.user.email ||
      "Unknown";
    const reason =
      (body.reason as string)?.trim() ||
      "Reversed from loan actions; cash returned to cashier";

    const payout = await prisma.loanPayout.findFirst({
      where: {
        tenantId: tenant.id,
        fineractLoanId,
      },
    });

    if (!payout) {
      return NextResponse.json(
        { error: "No payout record found for this loan. Nothing to reverse." },
        { status: 404 }
      );
    }

    if (payout.status === "REVERSED" || payout.status === "VOIDED") {
      return NextResponse.json(
        { error: "This payout has already been reversed or voided." },
        { status: 400 }
      );
    }

    if (payout.status !== "PAID") {
      return NextResponse.json(
        {
          error:
            "Only paid payouts can be reversed. Current status: " + payout.status,
        },
        { status: 400 }
      );
    }

    const reversedAt = new Date();
    await prisma.loanPayout.update({
      where: { id: payout.id },
      data: {
        status: "REVERSED",
        voidedAt: reversedAt,
        voidedBy: reversedBy,
        voidReason: reason,
      },
    });

    return NextResponse.json({
      success: true,
      message:
        "Payout reversed. Cash will show as returned in the cashier transaction history.",
      payout: {
        id: payout.id,
        fineractLoanId: payout.fineractLoanId,
        clientName: payout.clientName,
        amount: payout.amount,
        currency: payout.currency,
        status: "REVERSED",
        voidedAt: reversedAt.toISOString(),
        voidedBy: reversedBy,
      },
    });
  } catch (error) {
    console.error("Reverse payout error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to reverse payout",
      },
      { status: 500 }
    );
  }
}
