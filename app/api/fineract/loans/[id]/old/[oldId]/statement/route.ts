import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";
import { buildFineractRequest } from "@/lib/api";
import {
  generateConsolidatedStatementHTML,
  getStatementTransactionAmounts,
  getStatementTransactionType,
  parseFineractDate,
  type ConsolidatedStatementData,
  type ConsolidatedTransaction,
} from "@/lib/loan-statement-template";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getSession, getCurrentUserDetails } from "@/lib/auth";
import { type TransactionLike } from "@/lib/format-transaction";

type RefinanceLoanLike = {
  id?: string | number;
  isTopup?: boolean;
  clientId?: string | number;
  clientName?: string;
  accountNo?: string;
  loanProductName?: string;
  productName?: string;
  loanProductDescription?: string;
  currency?: {
    code?: string;
    displaySymbol?: string;
  };
  transactions?: TransactionLike[];
  topupDetails?: {
    loanIdToClose?: string | number;
    accountNoToClose?: string;
    topupAmount?: number | null;
  };
  closureLoanId?: string | number;
  closureLoanAccountNo?: string;
  topupAmount?: number | null;
};

function getTransactionSortDate(dateValue: string | number[] | undefined): number {
  if (!dateValue) return 0;

  if (Array.isArray(dateValue)) {
    const [year, month, day] = dateValue;
    return new Date(year, month - 1, day).getTime();
  }

  return new Date(dateValue).getTime();
}

function resolveRefinancedLoanLink(loan: RefinanceLoanLike) {
  return {
    oldLoanId: loan?.topupDetails?.loanIdToClose ?? loan?.closureLoanId,
    oldLoanAccountNo:
      loan?.topupDetails?.accountNoToClose ?? loan?.closureLoanAccountNo,
    topupAmount: loan?.topupDetails?.topupAmount ?? loan?.topupAmount ?? null,
  };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; oldId: string }> }
) {
  try {
    const { id: newLoanId, oldId } = await context.params;
    const { searchParams } = new URL(request.url);
    const formatType = searchParams.get("format") || "html";
    const fromDate = searchParams.get("from");
    const toDate = searchParams.get("to");

    const [newLoanRequest, oldLoanRequest] = await Promise.all([
      buildFineractRequest(`/loans/${newLoanId}?associations=all`, {
        authMode: "service",
        headers: { Accept: "application/json" },
      }),
      buildFineractRequest(`/loans/${oldId}?associations=all`, {
        authMode: "service",
        headers: { Accept: "application/json" },
      }),
    ]);

    const [newLoanResponse, oldLoanResponse] = await Promise.all([
      fetch(newLoanRequest.url, { headers: newLoanRequest.headers }),
      fetch(oldLoanRequest.url, { headers: oldLoanRequest.headers }),
    ]);

    if (!newLoanResponse.ok) {
      return NextResponse.json(
        { error: `Refinance loan ${newLoanId} not found` },
        { status: newLoanResponse.status }
      );
    }

    if (!oldLoanResponse.ok) {
      return NextResponse.json(
        { error: `Old loan ${oldId} not found` },
        { status: oldLoanResponse.status }
      );
    }

    const [newLoan, oldLoan]: [RefinanceLoanLike, RefinanceLoanLike] = await Promise.all([
      newLoanResponse.json(),
      oldLoanResponse.json(),
    ]);

    const refinanceLink = resolveRefinancedLoanLink(newLoan);
    const linkedOldLoanId = refinanceLink.oldLoanId;
    if (newLoan.isTopup !== true || Number(linkedOldLoanId) !== Number(oldLoan.id)) {
      return NextResponse.json(
        {
          error: `Loan ${newLoanId} is not linked to old loan ${oldId} as a refinance/top-up.`,
        },
        { status: 400 }
      );
    }

    if (
      newLoan.clientId &&
      oldLoan.clientId &&
      Number(newLoan.clientId) !== Number(oldLoan.clientId)
    ) {
      return NextResponse.json(
        { error: "The two loans belong to different clients." },
        { status: 400 }
      );
    }

    let clientData = null;
    const clientId = newLoan.clientId || oldLoan.clientId;
    if (clientId) {
      const clientRequest = await buildFineractRequest(`/clients/${clientId}`, {
        authMode: "service",
        headers: { Accept: "application/json" },
      });
      const clientResponse = await fetch(
        clientRequest.url,
        { headers: clientRequest.headers }
      );

      if (clientResponse.ok) {
        clientData = await clientResponse.json();
      }
    }

    type RawTransaction = {
      sortDate: number;
      loanAccount: string;
      tx: TransactionLike;
    };

    const loans = [
      { loan: oldLoan, roleLabel: "Old Loan" },
      { loan: newLoan, roleLabel: "Refinance Loan" },
    ];

    const perLoanTotals = new Map<
      string,
      {
        productName: string;
        totalDebits: number;
        totalCredits: number;
        closingBalance: number;
      }
    >();
    const rawTransactions: RawTransaction[] = [];

    for (const { loan, roleLabel } of loans) {
      const accountLabel = `${loan.accountNo || loan.id} (${roleLabel})`;
      const productName = loan.loanProductName || loan.productName || "Unknown Product";

      perLoanTotals.set(accountLabel, {
        productName,
        totalDebits: 0,
        totalCredits: 0,
        closingBalance: 0,
      });

      for (const tx of loan.transactions || []) {
        const sortDate = getTransactionSortDate(tx.date);

        if (fromDate && sortDate < new Date(fromDate).getTime()) continue;
        if (toDate && sortDate > new Date(toDate).getTime()) continue;

        rawTransactions.push({
          sortDate,
          loanAccount: accountLabel,
          tx,
        });
      }
    }

    rawTransactions.sort(
      (a, b) => a.sortDate - b.sortDate || a.loanAccount.localeCompare(b.loanAccount)
    );

    const transactions: ConsolidatedTransaction[] = [];
    let totalDebits = 0;
    let totalCredits = 0;
    let runningBalance = 0;

    for (const rawTransaction of rawTransactions) {
      const {
        debit,
        credit,
        effectiveDebit,
        effectiveCredit,
        isHighlighted,
        isReversed,
      } = getStatementTransactionAmounts(rawTransaction.tx);

      totalDebits += effectiveDebit;
      totalCredits += effectiveCredit;
      runningBalance += effectiveDebit - effectiveCredit;

      const loanTotals = perLoanTotals.get(rawTransaction.loanAccount);
      if (loanTotals) {
        loanTotals.totalDebits += effectiveDebit;
        loanTotals.totalCredits += effectiveCredit;
        loanTotals.closingBalance += effectiveDebit - effectiveCredit;
      }

      transactions.push({
        date: parseFineractDate(rawTransaction.tx.date),
        loanAccount: rawTransaction.loanAccount,
        type: getStatementTransactionType(rawTransaction.tx),
        trxnId: rawTransaction.tx.id?.toString() || "",
        debit,
        credit,
        cumulativeBalance: Math.max(0, runningBalance),
        isHighlighted,
        isReversed,
      });
    }

    const tenant = await getTenantFromHeaders();
    const session = await getSession();
    const companyInfo = {
      name: tenant?.name || "Organization",
      logoUrl: tenant?.logoFileUrl || undefined,
    };

    let preparedBy: string | undefined;
    if (session?.user?.id) {
      try {
        const userData = await getCurrentUserDetails(session.user.id);
        const firstName = userData.firstname || "";
        const lastName = userData.lastname || "";
        preparedBy =
          `${firstName} ${lastName}`.trim() || session.user.name || undefined;
      } catch {
        preparedBy = session.user.name || undefined;
      }
    }

    const now = new Date();
    const formattedFromDate = fromDate
      ? new Date(fromDate).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
      : transactions.length > 0
        ? transactions[0].date
        : format(now, "dd MMMM yyyy");
    const formattedToDate = toDate
      ? new Date(toDate).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
      : format(now, "dd MMMM yyyy");

    const currencyCode =
      newLoan.currency?.code || oldLoan.currency?.code || "ZMW";
    const currencySymbol =
      newLoan.currency?.displaySymbol ||
      oldLoan.currency?.displaySymbol ||
      currencyCode;

    const statementData: ConsolidatedStatementData = {
      companyName: companyInfo.name,
      logoUrl: companyInfo.logoUrl,
      statementTitle: "Refinance Trail Statement",
      statementSubtitle: `${oldLoan.accountNo || oldLoan.id} -> ${newLoan.accountNo || newLoan.id}`,
      clientName:
        clientData?.displayName || newLoan.clientName || oldLoan.clientName || "N/A",
      printDate: format(now, "M/d/yyyy h:mm:ss a"),
      periodFrom: formattedFromDate,
      periodTo: formattedToDate,
      currency: currencyCode,
      currencySymbol,
      loanSummaries: Array.from(perLoanTotals.entries()).map(([accountNo, summary]) => ({
        accountNo,
        productName: summary.productName,
        totalDebits: summary.totalDebits,
        totalCredits: summary.totalCredits,
        closingBalance: Math.max(0, summary.closingBalance),
      })),
      transactions,
      totalDebits,
      totalCredits,
      closingBalance: Math.max(0, runningBalance),
      preparedBy,
    };

    if (formatType === "json") {
      return NextResponse.json({
        success: true,
        data: statementData,
        relationship: {
          newLoanId: Number(newLoan.id),
          oldLoanId: Number(oldLoan.id),
          topupAmount: refinanceLink.topupAmount,
          oldLoanAccountNo: refinanceLink.oldLoanAccountNo ?? null,
        },
      });
    }

    const html = generateConsolidatedStatementHTML(statementData);

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="refinance-trail-${oldLoan.accountNo || oldLoan.id}-${newLoan.accountNo || newLoan.id}.html"`,
      },
    });
  } catch (error) {
    console.error("Error generating refinance trail statement:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to generate refinance trail statement: ${errorMessage}` },
      { status: 500 }
    );
  }
}
