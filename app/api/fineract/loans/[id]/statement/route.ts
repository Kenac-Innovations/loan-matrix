import { NextRequest, NextResponse } from "next/server";
import { getAccessToken, getFineractTenantId } from "@/lib/api";
import {
  generateLoanStatementHTML,
  getStatementContainerAndStyles,
  transformFineractLoanToStatement,
} from "@/lib/loan-statement-template";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getSession, getCurrentUserDetails } from "@/lib/auth";

const baseUrl = process.env.FINERACT_BASE_URL || "http://10.10.0.143:8443";

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

    const accessToken = await getAccessToken();
    const fineractTenantId = await getFineractTenantId();

    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("=== GENERATING LOAN STATEMENT ===");
    console.log("Loan ID:", loanId);
    console.log("Format:", format);

    // Fetch loan with all associations
    const loanUrl = `${baseUrl}/fineract-provider/api/v1/loans/${loanId}?associations=all`;
    console.log("Fetching loan from:", loanUrl);

    const loanResponse = await fetch(loanUrl, {
      method: "GET",
      headers: {
        Authorization: `Basic ${accessToken}`,
        "Fineract-Platform-TenantId": fineractTenantId,
        Accept: "application/json",
      },
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
        const clientUrl = `${baseUrl}/fineract-provider/api/v1/clients/${loanData.clientId}`;
        const clientResponse = await fetch(clientUrl, {
          method: "GET",
          headers: {
            Authorization: `Basic ${accessToken}`,
            "Fineract-Platform-TenantId": fineractTenantId,
            Accept: "application/json",
          },
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
    if (fromDate || toDate) {
      transactions = transactions.filter((tx: any) => {
        const txDate = Array.isArray(tx.date)
          ? new Date(tx.date[0], tx.date[1] - 1, tx.date[2])
          : new Date(tx.date);

        if (fromDate && new Date(fromDate) > txDate) return false;
        if (toDate && new Date(toDate) < txDate) return false;
        return true;
      });
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
      preparedBy
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

    // Embeddable format for React pages (e.g. with react-to-pdf)
    if (format === "html-embed") {
      const { container, styles } = getStatementContainerAndStyles(statementData);
      return NextResponse.json({
        success: true,
        container,
        styles,
        accountNumber: loanData.accountNo,
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
