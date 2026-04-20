import { NextRequest, NextResponse } from "next/server";
import {
  getRepaymentCashLink,
  markRepaymentCashLinkReversed,
} from "@/lib/repayment-cash-link";
import { getTenantFromHeaders } from "@/lib/tenant-service";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string; transactionId: string }> }
) {
  try {
    const tenant = await getTenantFromHeaders();
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const { id, transactionId } = await context.params;
    const fineractTransactionId = Number(transactionId);
    const parsedLoanId = Number(id);

    console.log(`[fineractTransactionId]: ${fineractTransactionId}`)

    if (!Number.isFinite(fineractTransactionId) || !Number.isFinite(parsedLoanId)) {
      return NextResponse.json({ error: "Invalid loan or transaction id" }, { status: 400 });
    }

    const link = await getRepaymentCashLink(tenant.id, fineractTransactionId);
    if (!link || link.loanId !== parsedLoanId) {
      return NextResponse.json({ error: "Repayment link not found" }, { status: 404 });
    }

    return NextResponse.json(link);
  } catch (error: any) {
    console.error("Error fetching repayment link:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch repayment link" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; transactionId: string }> }
) {
  try {
    const tenant = await getTenantFromHeaders();
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const { id, transactionId } = await context.params;
    const fineractTransactionId = Number(transactionId);
    const parsedLoanId = Number(id);

    if (!Number.isFinite(fineractTransactionId) || !Number.isFinite(parsedLoanId)) {
      return NextResponse.json({ error: "Invalid loan or transaction id" }, { status: 400 });
    }

    const existing = await getRepaymentCashLink(tenant.id, fineractTransactionId);
    if (!existing || existing.loanId !== parsedLoanId) {
      return NextResponse.json({ error: "Repayment link not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const updated = await markRepaymentCashLinkReversed(
      tenant.id,
      fineractTransactionId,
      typeof body.reversalNotes === "string" ? body.reversalNotes : null
    );

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Error updating repayment link:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update repayment link" },
      { status: 500 }
    );
  }
}
