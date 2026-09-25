import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";
import { buildFineractRequest } from "@/lib/api";
import {
  generateLoanStatementHTML,
  transformFineractLoanToStatement,
  getPrincipalBalanceEffect,
} from "@/lib/loan-statement-template";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getSession, getCurrentUserDetails } from "@/lib/auth";
import { resolveInterestRateDisplayMode } from "@/lib/interest-rate-display";

/**
 * GET /api/fineract/loans/[id]/statement
 * Generates a loan account statement in HTML or JSON format
 * 
 * Query params:
 * - format: "html" (default) | "json" - Output format
 * - from: Date string - Start date for transaction filter (optional)
 * - to: Date string - End date for transaction filter (optional)
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id: loanId } = params;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "html";
    const fromDate = searchParams.get("from");
    const toDate = searchParams.get("to");
    const hasTransactionDateFilter = Boolean(fromDate || toDate);

    console.log("=== GENERATING LOAN STATEMENT ===");
    console.log("Loan ID:", loanId);
    console.log("Format:", format);

    const { headers: loanHeaders, url: loanUrl } = await buildFineractRequest(
      `/loans/${loanId}?associations=all`,
      {
        authMode: "service",
        headers: {
          Accept: "application/json",
        },
      }
    );
    console.log("Fetching loan from:", loanUrl);

    const loanResponse = await fetch(loanUrl, {
      method: "GET",
      headers: loanHeaders,
    });

    if (!loanResponse.ok) {
      if (loanResponse.status === 404) {
        return NextResponse.json(
          { error: "Loan not found" },
          { status: 404 }
        );
      }
      const errorData = await loanResponse.json();
      console.error("Fineract loan fetch error:", errorData);
      return NextResponse.json(
        { error: errorData.developerMessage || "Failed to fetch loan" },
        { status: loanResponse.status }
      );
    }

    const loanData = await loanResponse.json();
    console.log("Loan fetched successfully:", loanData.accountNo);

    // Fetch client details if clientId is available
    let clientData = null;
    if (loanData.clientId) {
      try {
        const { headers: clientHeaders, url: clientUrl } = await buildFineractRequest(
          `/clients/${loanData.clientId}`,
          {
            authMode: "service",
            headers: {
              Accept: "application/json",
            },
          }
        );
        const clientResponse = await fetch(clientUrl, {
          method: "GET",
          headers: clientHeaders,
        });

        if (clientResponse.ok) {
          clientData = await clientResponse.json();
          console.log("Client fetched successfully:", clientData.displayName);
        }
      } catch (clientError) {
        console.warn("Could not fetch client details:", clientError);
      }
    }

    const tenant = await getTenantFromHeaders();
    const companyInfo = {
      name: tenant?.name || "Organization",
      logoUrl: tenant?.logoFileUrl || undefined,
    };
    const interestRateDisplayMode = resolveInterestRateDisplayMode(
      tenant?.slug,
      tenant?.settings
    );

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

    // Filter transactions by date if provided
    let transactions = loanData.transactions || [];
    let openingPrincipalBalance = 0;
    if (hasTransactionDateFilter) {
      // Compare calendar dates as YYYY-MM-DD strings so the server timezone
      // cannot shift transactions across the from/to boundaries.
      const fromKey = fromDate ? toDateKey(fromDate) : null;
      const toKey = toDate ? toDateKey(toDate) : null;
      const inPeriod: typeof transactions = [];
      for (const tx of transactions) {
        const txKey = toDateKey(tx.date);
        if (fromKey && txKey < fromKey) {
          // Carried forward into the Balance B/Fwd row
          openingPrincipalBalance += getPrincipalBalanceEffect(tx);
        } else if (!toKey || txKey <= toKey) {
          inPeriod.push(tx);
        }
      }
      transactions = inPeriod;
      loanData.transactions = transactions;
    }

    // Format period dates if provided
    const formattedFromDate = fromDate
      ? new Date(fromDate).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
      : undefined;
    const formattedToDate = toDate
      ? new Date(toDate).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
      : undefined;

    // Transform data to statement format
    const statementData = transformFineractLoanToStatement(
      loanData,
      clientData,
      companyInfo,
      formattedFromDate,
      formattedToDate,
      undefined,
      preparedBy,
      interestRateDisplayMode,
      {
        // The Fineract summary is the current full-loan balance, not an
        // as-of balance for a filtered transaction period.
        balanceSource: hasTransactionDateFilter ? "transaction-ledger" : "summary",
        // Pass the opening principal balance computed before the from date
        openingBalance: openingPrincipalBalance,
      }
    );

    // Return based on requested format
    if (format === "json") {
      return NextResponse.json({
        success: true,
        data: statementData,
        loan: {
          id: loanData.id,
          accountNo: loanData.accountNo,
          clientName: loanData.clientName,
          status: loanData.status?.value,
        },
      });
    }

    // Generate HTML
    const html = generateLoanStatementHTML(statementData);

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="loan-statement-${loanData.accountNo}.html"`,
      },
    });
  } catch (error) {
    console.error("Error generating loan statement:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to generate statement: ${errorMessage}` },
      { status: 500 }
    );
  }
}

function toDateKey(value: string | number[] | undefined): string {
  if (Array.isArray(value)) {
    const [y, m, d] = value;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  const iso = /^\d{4}-\d{2}-\d{2}/.exec(value ?? "");
  return iso ? iso[0] : format(new Date(value ?? ""), "yyyy-MM-dd");
}
