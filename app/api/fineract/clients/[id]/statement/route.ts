import { NextRequest, NextResponse } from "next/server";
import { getAccessToken, getFineractTenantId } from "@/lib/api";
import { format } from "date-fns";
import {
  generateConsolidatedStatementHTML,
  parseFineractDate,
  type ConsolidatedStatementData,
  type ConsolidatedTransaction,
} from "@/lib/loan-statement-template";

function formatChargeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getConsolidatedTransactionType(tx: any): string {
  if (tx.type?.repaymentAtDisbursement) return "Admin Fee";
  const paidCharges = tx.loanChargePaidByList;
  if (Array.isArray(paidCharges) && paidCharges.length === 1) {
    const charge = paidCharges[0];
    const chargeName =
      charge?.chargeName ||
      charge?.name ||
      charge?.loanChargeName ||
      charge?.charge?.name;
    if (typeof chargeName === "string" && chargeName.trim()) {
      return formatChargeName(chargeName);
    }
  }
  return tx.type?.value || "";
}
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getSession, getCurrentUserDetails } from "@/lib/auth";

const baseUrl = process.env.FINERACT_BASE_URL || "http://10.10.0.143:8443";

/**
 * GET /api/fineract/clients/[id]/statement
 * Generates a consolidated statement across ALL loans for a client.
 *
 * Query params:
 *   format: "html" (default) | "json"
 *   from / to: optional date-range filter
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await context.params;
    const { searchParams } = new URL(request.url);
    const fmt = searchParams.get("format") || "html";
    const fromDate = searchParams.get("from");
    const toDate = searchParams.get("to");

    const accessToken = await getAccessToken();
    const fineractTenantId = await getFineractTenantId();

    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const headers = {
      Authorization: `Basic ${accessToken}`,
      "Fineract-Platform-TenantId": fineractTenantId,
      Accept: "application/json",
    };

    // 1. Fetch client details
    const clientRes = await fetch(
      `${baseUrl}/fineract-provider/api/v1/clients/${clientId}`,
      { headers }
    );
    if (!clientRes.ok) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: clientRes.status }
      );
    }
    const clientData = await clientRes.json();

    // 2. Fetch client accounts to get all loan IDs
    const accountsRes = await fetch(
      `${baseUrl}/fineract-provider/api/v1/clients/${clientId}/accounts`,
      { headers }
    );
    if (!accountsRes.ok) {
      return NextResponse.json(
        { error: "Failed to fetch client accounts" },
        { status: accountsRes.status }
      );
    }
    const accountsData = await accountsRes.json();
    const loanAccounts: any[] = accountsData.loanAccounts || [];

    if (loanAccounts.length === 0) {
      return NextResponse.json(
        { error: "No loan accounts found for this client" },
        { status: 404 }
      );
    }

    // 3. Fetch full loan data (with transactions) for every loan in parallel
    const loanFetches = loanAccounts.map((la) =>
      fetch(
        `${baseUrl}/fineract-provider/api/v1/loans/${la.id}?associations=all`,
        { headers }
      ).then((r) => (r.ok ? r.json() : null))
    );
    const allLoans = (await Promise.all(loanFetches)).filter(Boolean);

    // 4. Build per-loan charge-name lookups, flatten transactions
    const perLoanTotals: Map<
      string,
      { productName: string; totalDebits: number; totalCredits: number; closingBalance: number }
    > = new Map();

    interface RawTx {
      sortDate: number;
      accountNo: string;
      tx: any;
    }
    const rawTxs: RawTx[] = [];

    for (const loan of allLoans) {
      const accountNo: string = loan.accountNo || "";
      const productName: string = loan.loanProductName || loan.loanProductDescription || "";
      const transactions: any[] = loan.transactions || [];

      perLoanTotals.set(accountNo, {
        productName,
        totalDebits: 0,
        totalCredits: 0,
        closingBalance: 0,
      });

      for (const tx of transactions) {
        let sortDate: number;
        if (Array.isArray(tx.date)) {
          sortDate = new Date(tx.date[0], tx.date[1] - 1, tx.date[2]).getTime();
        } else {
          sortDate = new Date(tx.date).getTime();
        }

        if (fromDate && sortDate < new Date(fromDate).getTime()) continue;
        if (toDate && sortDate > new Date(toDate).getTime()) continue;

        rawTxs.push({ sortDate, accountNo, tx });
      }
    }

    // 5. Sort all transactions by date, then by loan account
    rawTxs.sort((a, b) => a.sortDate - b.sortDate || a.accountNo.localeCompare(b.accountNo));

    // 6. Process into consolidated transactions
    let grandDebits = 0;
    let grandCredits = 0;
    let runningBalance = 0;
    const consolidatedTxs: ConsolidatedTransaction[] = [];

    for (const { accountNo, tx } of rawTxs) {
      const isDisbursement = tx.type?.disbursement;
      const isRepayment = tx.type?.repayment;
      const isRepaymentAtDisbursement = tx.type?.repaymentAtDisbursement;
      const isAccrual = tx.type?.accrual;
      const isChargePayment = tx.type?.code?.includes("chargePayment");
      const isWaiver =
        tx.type?.code?.includes("waive") ||
        tx.type?.value?.toLowerCase().includes("waiv");
      const isWriteOff =
        tx.type?.code?.includes("writeOff") ||
        tx.type?.value?.toLowerCase().includes("write-off");

      let debit = 0;
      let credit = 0;
      let isHighlighted = false;

      if (isDisbursement) {
        debit = tx.amount || 0;
        isHighlighted = true;
      } else if (isAccrual) {
        debit = tx.amount || 0;
      } else if (isRepaymentAtDisbursement || isRepayment || isChargePayment) {
        credit = tx.amount || 0;
        isHighlighted = true;
      } else if (isWaiver || isWriteOff) {
        credit = tx.amount || 0;
      }

      grandDebits += debit;
      grandCredits += credit;
      runningBalance += debit - credit;

      const loanTotals = perLoanTotals.get(accountNo)!;
      loanTotals.totalDebits += debit;
      loanTotals.totalCredits += credit;
      loanTotals.closingBalance += debit - credit;

      consolidatedTxs.push({
        date: parseFineractDate(tx.date),
        loanAccount: accountNo,
        type: getConsolidatedTransactionType(tx),
        trxnId: tx.id?.toString() || "",
        debit,
        credit,
        cumulativeBalance: Math.max(0, runningBalance),
        isHighlighted,
      });
    }

    // 7. Company / tenant info
    const tenant = await getTenantFromHeaders();
    const companyInfo = {
      name: tenant?.name || "Organization",
      logoUrl: tenant?.logoFileUrl || undefined,
    };

    // 8. Logged-in user
    const session = await getSession();
    let preparedBy: string | undefined;
    if (session?.user?.id) {
      try {
        const userData = await getCurrentUserDetails(session.user.id);
        const firstName = userData.firstname || "";
        const lastName = userData.lastname || "";
        preparedBy = `${firstName} ${lastName}`.trim() || session.user.name || undefined;
      } catch {
        preparedBy = session.user.name || undefined;
      }
    }

    // 9. Period dates
    const now = new Date();
    const formattedFrom = fromDate
      ? new Date(fromDate).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })
      : consolidatedTxs.length > 0
        ? consolidatedTxs[0].date
        : format(now, "dd MMMM yyyy");
    const formattedTo = toDate
      ? new Date(toDate).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })
      : format(now, "dd MMMM yyyy");

    const statementData: ConsolidatedStatementData = {
      companyName: companyInfo.name,
      logoUrl: companyInfo.logoUrl,
      clientName: clientData.displayName || "N/A",
      printDate: format(now, "M/d/yyyy h:mm:ss a"),
      periodFrom: formattedFrom,
      periodTo: formattedTo,
      currency: "ZMW",
      currencySymbol: "ZMW",
      loanSummaries: Array.from(perLoanTotals.entries()).map(
        ([accountNo, s]) => ({
          accountNo,
          productName: s.productName,
          totalDebits: s.totalDebits,
          totalCredits: s.totalCredits,
          closingBalance: Math.max(0, s.closingBalance),
        })
      ),
      transactions: consolidatedTxs,
      totalDebits: grandDebits,
      totalCredits: grandCredits,
      closingBalance: Math.max(0, runningBalance),
      preparedBy,
    };

    if (fmt === "json") {
      return NextResponse.json({ success: true, data: statementData });
    }

    const html = generateConsolidatedStatementHTML(statementData);

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="consolidated-statement-${clientData.displayName || clientId}.html"`,
      },
    });
  } catch (error) {
    console.error("Error generating consolidated statement:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to generate consolidated statement: ${msg}` },
      { status: 500 }
    );
  }
}
