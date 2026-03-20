import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSession as getCustomSession } from "@/app/actions/auth";
import { getFineractTenantId } from "@/lib/fineract-tenant-service";
import { getOrgDefaultCurrencyCode } from "@/lib/currency-utils";

const baseUrl = process.env.FINERACT_BASE_URL || "http://10.10.0.143:8443";

/**
 * Get access token from session
 */
async function getAccessToken(): Promise<string | undefined> {
  try {
    const nextAuthSession = (await getSession()) as any;
    if (nextAuthSession?.base64EncodedAuthenticationKey) {
      return nextAuthSession.base64EncodedAuthenticationKey;
    }
    if (nextAuthSession?.accessToken) {
      return nextAuthSession.accessToken;
    }

    const customSession = (await getCustomSession()) as any;
    if (customSession?.base64EncodedAuthenticationKey) {
      return customSession.base64EncodedAuthenticationKey;
    }
    if (customSession?.accessToken) {
      return customSession.accessToken;
    }

    return undefined;
  } catch (error) {
    console.error("Error getting access token:", error);
    return undefined;
  }
}

/**
 * GET /api/fineract/clients-metrics
 * Gets client metrics and statistics from Fineract
 */
export async function GET() {
  try {
    console.log("Client Metrics API: Starting metrics calculation");

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

    // Fetch clients with pagination info
    console.log("Client Metrics API: Fetching clients");
    const clientsResponse = await fetch(
      `${baseUrl}/fineract-provider/api/v1/clients?limit=1&paged=true`,
      { method: "GET", headers, cache: "no-store" }
    );

    let totalClients = 0;
    if (clientsResponse.ok) {
      const clientsData = await clientsResponse.json();
      totalClients = clientsData.totalFilteredRecords || 0;
    }

    // Fetch active clients count
    const activeClientsResponse = await fetch(
      `${baseUrl}/fineract-provider/api/v1/clients?status=active&limit=1&paged=true`,
      { method: "GET", headers, cache: "no-store" }
    );

    let activeClients = 0;
    if (activeClientsResponse.ok) {
      const activeData = await activeClientsResponse.json();
      activeClients = activeData.totalFilteredRecords || 0;
    }

    const inactiveClients = totalClients - activeClients;

    // Fetch loans for portfolio calculations
    console.log("Client Metrics API: Fetching loans for portfolio value");
    const loansResponse = await fetch(
      `${baseUrl}/fineract-provider/api/v1/loans?limit=5000`,
      { method: "GET", headers, cache: "no-store" }
    );

    const orgCurrency = await getOrgDefaultCurrencyCode();
    let totalPortfolioValue = 0;
    let totalOutstanding = 0;
    let averageLoanAmount = 0;
    let riskClients = 0;
    let currency = orgCurrency;
    let loansCount = 0;
    let activeLoansCount = 0;

    if (loansResponse.ok) {
      const loansData = await loansResponse.json();
      const loans = loansData.pageItems || loansData || [];
      loansCount = loans.length;

      // Get currency from first loan
      if (loans.length > 0 && loans[0].currency) {
        currency = loans[0].currency.code || loans[0].currency || orgCurrency;
      }

      // Calculate portfolio metrics
      for (const loan of loans) {
        const principal = loan.principal || 0;
        const outstanding = loan.summary?.totalOutstanding || 0;
        const status = loan.status?.value?.toLowerCase() || "";

        totalPortfolioValue += principal;
        totalOutstanding += outstanding;

        // Count active loans
        if (status.includes("active")) {
          activeLoansCount++;
        }

        // Count risk clients (loans in arrears)
        if (
          loan.inArrears ||
          (loan.summary?.totalOverdue && loan.summary.totalOverdue > 0)
        ) {
          riskClients++;
        }
      }

      averageLoanAmount = loansCount > 0 ? totalPortfolioValue / loansCount : 0;
    }

    // Calculate new clients this month (simplified - fetch recent clients)
    const currentDate = new Date();
    const firstDayOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1
    );
    const formattedDate = `${firstDayOfMonth.getDate()} ${firstDayOfMonth.toLocaleString(
      "en-US",
      { month: "long" }
    )} ${firstDayOfMonth.getFullYear()}`;

    let newClientsThisMonth = 0;
    const newClientsResponse = await fetch(
      `${baseUrl}/fineract-provider/api/v1/clients?sqlSearch=c.submittedon_date >= '${
        firstDayOfMonth.toISOString().split("T")[0]
      }'&limit=1&paged=true`,
      { method: "GET", headers, cache: "no-store" }
    );

    if (newClientsResponse.ok) {
      const newClientsData = await newClientsResponse.json();
      newClientsThisMonth = newClientsData.totalFilteredRecords || 0;
    }

    // Calculate growth rate
    const clientGrowthRate =
      newClientsThisMonth > 0
        ? (newClientsThisMonth /
            Math.max(totalClients - newClientsThisMonth, 1)) *
          100
        : 0;

    const metrics = {
      totalClients,
      activeClients,
      inactiveClients,
      newClientsThisMonth,
      totalPortfolioValue,
      totalOutstanding,
      averageLoanAmount,
      clientGrowthRate: Math.round(clientGrowthRate * 10) / 10,
      riskClients,
      currency,
      loansCount,
      activeLoansCount,
    };

    console.log("Client Metrics API: Calculated metrics:", metrics);

    return NextResponse.json(metrics);
  } catch (error: any) {
    console.error("Error fetching client metrics:", error);

    // Return empty metrics if Fineract is not available
    const emptyMetrics = {
      totalClients: 0,
      activeClients: 0,
      inactiveClients: 0,
      newClientsThisMonth: 0,
      totalPortfolioValue: 0,
      totalOutstanding: 0,
      averageLoanAmount: 0,
      clientGrowthRate: 0,
      riskClients: 0,
      currency: orgCurrency,
      loansCount: 0,
      activeLoansCount: 0,
    };

    console.log("Client Metrics API: Returning empty data due to error");
    return NextResponse.json(emptyMetrics);
  }
}
