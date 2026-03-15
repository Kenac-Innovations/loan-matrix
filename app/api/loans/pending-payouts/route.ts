import { NextRequest, NextResponse } from "next/server";
import { getFineractServiceWithSession } from "@/lib/fineract-api";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getOrgDefaultCurrencyCode } from "@/lib/currency-utils";

/**
 * GET /api/loans/pending-payouts
 * Get loans that are disbursed but not yet paid out to clients
 */
export async function GET(request: NextRequest) {
  try {
    const tenant = await getTenantFromHeaders();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const orgCurrency = await getOrgDefaultCurrencyCode();

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";

    // Fetch disbursed loans from Fineract
    const fineractService = await getFineractServiceWithSession();
    
    // Get loans with status 300 (Active/Disbursed)
    const loansResponse = await fineractService.getLoans({
      limit: 1000,
      sqlSearch: "l.loan_status_id = 300", // Active/Disbursed loans
    });

    const loans = loansResponse?.pageItems || loansResponse || [];

    // Get existing payouts from database
    const existingPayouts = await prisma.loanPayout.findMany({
      where: {
        tenantId: tenant.id,
        status: { in: ["PAID", "PENDING"] }, // Exclude VOIDED
      },
      select: {
        fineractLoanId: true,
        status: true,
      },
    });

    const paidLoanIds = new Set(
      existingPayouts
        .filter((p) => p.status === "PAID")
        .map((p) => p.fineractLoanId)
    );

    // Filter to only loans that haven't been paid out
    const pendingPayouts = loans
      .filter((loan: any) => !paidLoanIds.has(loan.id))
      .map((loan: any) => ({
        id: loan.id,
        loanId: loan.id,
        clientId: loan.clientId,
        clientName: loan.clientName || "Unknown Client",
        loanAccountNo: loan.accountNo || loan.loanAccountNo,
        productName: loan.loanProductName || loan.productName,
        principal: loan.principal || loan.approvedPrincipal,
        disbursedAmount: loan.principal || loan.approvedPrincipal,
        currency: loan.currency?.code || orgCurrency,
        disbursementDate: loan.timeline?.actualDisbursementDate || loan.actualDisbursementDate,
        status: existingPayouts.find((p) => p.fineractLoanId === loan.id)?.status || "PENDING",
      }));

    // Apply search filter if provided
    let filteredPayouts = pendingPayouts;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredPayouts = pendingPayouts.filter(
        (payout: any) =>
          payout.clientName?.toLowerCase().includes(searchLower) ||
          payout.loanAccountNo?.toLowerCase().includes(searchLower)
      );
    }

    return NextResponse.json({
      pendingPayouts: filteredPayouts,
      total: filteredPayouts.length,
    });
  } catch (error) {
    console.error("Error fetching pending payouts:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch pending payouts",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/loans/pending-payouts
 * Create or update a loan payout record (for syncing disbursed loans)
 */
export async function POST(request: NextRequest) {
  try {
    const tenant = await getTenantFromHeaders();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const orgCurrencyPost = await getOrgDefaultCurrencyCode();
    const body = await request.json();
    const { loanId, clientId, clientName, loanAccountNo, amount, currency } = body;

    if (!loanId || !clientId || !amount) {
      return NextResponse.json(
        { error: "loanId, clientId, and amount are required" },
        { status: 400 }
      );
    }

    // Create or update the payout record
    const payout = await prisma.loanPayout.upsert({
      where: {
        tenantId_fineractLoanId: {
          tenantId: tenant.id,
          fineractLoanId: loanId,
        },
      },
      update: {
        clientName,
        loanAccountNo,
        amount,
        currency: currency || orgCurrencyPost,
      },
      create: {
        tenantId: tenant.id,
        fineractLoanId: loanId,
        fineractClientId: clientId,
        clientName,
        loanAccountNo,
        amount,
        currency: currency || orgCurrencyPost,
        status: "PENDING",
      },
    });

    return NextResponse.json(payout);
  } catch (error) {
    console.error("Error creating payout record:", error);
    return NextResponse.json(
      {
        error: "Failed to create payout record",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
