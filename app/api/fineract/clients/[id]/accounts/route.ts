import { NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';

type LoanStatusLike = {
  value?: string;
  code?: string;
  active?: boolean;
  closed?: boolean;
};

type LoanAccountLike = {
  id?: number;
  loanBalance?: number;
  inArrears?: boolean;
  delinquent?: Record<string, unknown>;
  status?: LoanStatusLike;
  summary?: Record<string, unknown>;
};

function isRejectedOrWithdrawnStatus(status?: LoanStatusLike): boolean {
  const statusValue = `${status?.value || ""}`.toLowerCase();
  const statusCode = `${status?.code || ""}`.toLowerCase();

  return (
    statusValue.includes("rejected") ||
    statusValue.includes("withdrawn") ||
    statusCode.includes("rejected") ||
    statusCode.includes("withdrawn")
  );
}

function normalizeInactiveLoanBalances<T extends LoanAccountLike>(loan: T): T {
  if (!isRejectedOrWithdrawnStatus(loan.status)) {
    return loan;
  }

  return {
    ...loan,
    loanBalance: 0,
    inArrears: false,
    delinquent: {
      ...(loan.delinquent || {}),
      pastDueDays: 0,
      delinquentDays: 0,
      delinquentAmount: 0,
    },
    summary: {
      ...(loan.summary || {}),
      principalOutstanding: 0,
      totalOutstanding: 0,
      totalOverdue: 0,
      overdueSinceDate: null,
    },
  };
}

/**
 * GET /api/fineract/clients/[id]/accounts
 * Proxies to Fineract's client accounts endpoint and returns loanAccounts
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const endpoint = `/clients/${id}/accounts`;
    const data = await fetchFineractAPI(endpoint, {
      authMode: "service",
      cache: "no-store",
    });

    if (!data?.loanAccounts || !Array.isArray(data.loanAccounts) || data.loanAccounts.length === 0) {
      return NextResponse.json(data);
    }

    const detailedLoanAccounts = await Promise.all(
      data.loanAccounts.map(async (loanAccount: LoanAccountLike) => {
        if (!loanAccount?.id) return loanAccount;

        try {
          const loanDetails = await fetchFineractAPI(`/loans/${loanAccount.id}`, {
            authMode: "service",
            cache: "no-store",
          });

          return normalizeInactiveLoanBalances({
            ...loanAccount,
            ...loanDetails,
            summary: {
              ...(loanAccount.summary || {}),
              ...(loanDetails?.summary || {}),
            },
          });
        } catch (detailError) {
          console.warn(`Failed to enrich loan account ${loanAccount.id}:`, detailError);
          return normalizeInactiveLoanBalances(loanAccount);
        }
      })
    );

    return NextResponse.json({
      ...data,
      loanAccounts: detailedLoanAccounts,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching client accounts:', error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
