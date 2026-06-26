import { NextRequest, NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";

type LoanAccountRef = {
  id?: number;
};

type TransactionLike = {
  id?: number;
  officeName?: string;
  externalId?: string;
  date?: string | number[];
  manuallyReversed?: boolean;
  type?: {
    value?: string;
    disbursement?: boolean;
    repayment?: boolean;
    repaymentAtDisbursement?: boolean;
    accrual?: boolean;
    code?: string;
  };
  amount?: number;
  principalPortion?: number;
  interestPortion?: number;
  feeChargesPortion?: number;
  penaltyChargesPortion?: number;
  outstandingLoanBalance?: number;
  transactionId?: string;
  loanChargePaidByList?: Array<{
    amount?: number;
    chargeName?: string;
    name?: string;
    loanChargeName?: string;
    charge?: {
      name?: string;
    };
  }>;
};

type LoanWithTransactions = {
  id?: number;
  accountNo?: string;
  loanProductName?: string;
  loanProductDescription?: string;
  transactions?: TransactionLike[];
};

type AggregatedClientTransaction = TransactionLike & {
  loanId: number;
  loanAccountNo: string;
  loanProductName: string;
  sortDate: number;
};

function getTransactionTimestamp(
  value: string | number[] | undefined
): number | null {
  if (!value) return null;

  if (Array.isArray(value) && value.length >= 3) {
    const [year, month, day] = value;
    return new Date(year, month - 1, day).getTime();
  }

  if (typeof value === "string") {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const clientId = Number(id);

    if (!Number.isFinite(clientId)) {
      return NextResponse.json({ error: "Invalid client ID" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get("from");
    const toDate = searchParams.get("to");

    const fromTimestamp = fromDate
      ? new Date(`${fromDate}T00:00:00`).getTime()
      : null;
    const toTimestamp = toDate
      ? new Date(`${toDate}T23:59:59.999`).getTime()
      : null;

    const accountsData = await fetchFineractAPI(`/clients/${clientId}/accounts`, {
      authMode: "service",
      cache: "no-store",
    });

    const loanAccounts: LoanAccountRef[] = Array.isArray(accountsData?.loanAccounts)
      ? accountsData.loanAccounts
      : [];

    if (loanAccounts.length === 0) {
      return NextResponse.json({
        pageItems: [],
        totalRecords: 0,
        loanCount: 0,
        appliedFilters: { from: fromDate, to: toDate },
      });
    }

    const loans = (
      await Promise.all(
        loanAccounts.map(async (loanAccount) => {
          if (!loanAccount?.id) return null;

          try {
            return (await fetchFineractAPI(
              `/loans/${loanAccount.id}?associations=transactions`,
              {
                authMode: "service",
                cache: "no-store",
              }
            )) as LoanWithTransactions;
          } catch (error) {
            console.warn(
              `Failed to fetch transactions for loan ${loanAccount.id}:`,
              error
            );
            return null;
          }
        })
      )
    ).filter((loan): loan is LoanWithTransactions => Boolean(loan?.id));

    const transactions: AggregatedClientTransaction[] = [];

    for (const loan of loans) {
      const loanId = Number(loan.id);
      const loanAccountNo = loan.accountNo || String(loan.id || "");
      const loanProductName =
        loan.loanProductName || loan.loanProductDescription || "Loan";

      for (const transaction of loan.transactions || []) {
        const sortDate = getTransactionTimestamp(transaction.date);
        if (sortDate == null) continue;

        if (fromTimestamp != null && sortDate < fromTimestamp) continue;
        if (toTimestamp != null && sortDate > toTimestamp) continue;

        transactions.push({
          ...transaction,
          loanId,
          loanAccountNo,
          loanProductName,
          sortDate,
        });
      }
    }

    transactions.sort((a, b) => {
      if (b.sortDate !== a.sortDate) return b.sortDate - a.sortDate;
      if ((b.loanId || 0) !== (a.loanId || 0)) return (b.loanId || 0) - (a.loanId || 0);
      return (b.id || 0) - (a.id || 0);
    });

    return NextResponse.json({
      pageItems: transactions,
      totalRecords: transactions.length,
      loanCount: loans.length,
      appliedFilters: { from: fromDate, to: toDate },
    });
  } catch (error) {
    console.error("Error fetching client transactions:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: message || "Failed to fetch client transactions" },
      { status: 500 }
    );
  }
}
