import { fetchFineractAPI } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export interface DashboardData {
  summary: {
    totalLoans: {
      count: number;
      amount: number;
      currency?: {
        code: string;
        name: string;
        decimalPlaces: number;
        displaySymbol: string;
        displayLabel: string;
      };
    };
    activeClients: number;
    pendingApprovals: number;
    overdueLoans: number;
  };
  portfolioDistribution: Array<{
    name: string;
    count: number;
    amount: number;
  }>;
  riskAssessment: {
    low: number;
    medium: number;
    high: number;
    total: number;
  };
  recentApplications: Array<{
    id: string | number;
    clientName: string;
    amount: number;
    productName: string;
    status: string;
    submittedDate: string;
    type: "lead" | "loan";
    currency?: {
      code: string;
      displaySymbol: string;
    };
  }>;
  loanProducts: Array<any>;
}

export async function fetchDashboardData(): Promise<DashboardData> {
  try {
    console.log("Starting dashboard data fetch...");

    // Fetch data from multiple endpoints in parallel
    const [
      clientsResponse,
      loansResponse,
      pendingLoansResponse,
      overdueLoansResponse,
      loanProductsResponse,
    ] = await Promise.allSettled([
      fetchFineractAPI("/clients?limit=1000"),
      fetchFineractAPI("/loans?limit=1000"),
      fetchFineractAPI("/loans?sqlSearch=l.loan_status_id = 100"), // Pending approval
      fetchFineractAPI(
        "/loans?sqlSearch=l.loan_status_id = 300 AND l.total_outstanding_derived > 0 AND DATEDIFF(CURDATE(), l.expected_maturedon_date) > 0"
      ), // Overdue
      fetchFineractAPI("/loanproducts"),
    ]);

    // Log the responses for debugging
    console.log("API Responses:", {
      clients: clientsResponse.status,
      loans: loansResponse.status,
      pendingLoans: pendingLoansResponse.status,
      overdueLoans: overdueLoansResponse.status,
      loanProducts: loanProductsResponse.status,
    });

    // Log any errors
    if (clientsResponse.status === "rejected") {
      console.error("Clients API error:", clientsResponse.reason);
    }
    if (loansResponse.status === "rejected") {
      console.error("Loans API error:", loansResponse.reason);
    }

    // Extract data from successful responses
    const clients =
      clientsResponse.status === "fulfilled" ? clientsResponse.value : [];
    const loans =
      loansResponse.status === "fulfilled" ? loansResponse.value : [];
    const pendingLoans =
      pendingLoansResponse.status === "fulfilled"
        ? pendingLoansResponse.value
        : [];
    const overdueLoans =
      overdueLoansResponse.status === "fulfilled"
        ? overdueLoansResponse.value
        : [];
    const loanProducts =
      loanProductsResponse.status === "fulfilled"
        ? loanProductsResponse.value
        : [];

    // Log the actual structure to understand Fineract response format
    console.log("Raw API responses:", {
      clients: clients,
      loans: loans,
      clientsKeys: clients ? Object.keys(clients) : "null",
      loansKeys: loans ? Object.keys(loans) : "null",
    });

    // Handle Fineract API response format - they might return objects with pageItems or similar
    const clientsArray = Array.isArray(clients)
      ? clients
      : clients?.pageItems || clients?.content || clients?.data || [];

    const loansArray = Array.isArray(loans)
      ? loans
      : loans?.pageItems || loans?.content || loans?.data || [];

    const pendingLoansArray = Array.isArray(pendingLoans)
      ? pendingLoans
      : pendingLoans?.pageItems ||
        pendingLoans?.content ||
        pendingLoans?.data ||
        [];

    const overdueLoansArray = Array.isArray(overdueLoans)
      ? overdueLoans
      : overdueLoans?.pageItems ||
        overdueLoans?.content ||
        overdueLoans?.data ||
        [];

    console.log("Processed arrays:", {
      clientsCount: Array.isArray(clientsArray)
        ? clientsArray.length
        : "not array",
      loansCount: Array.isArray(loansArray) ? loansArray.length : "not array",
      pendingLoansCount: Array.isArray(pendingLoansArray)
        ? pendingLoansArray.length
        : "not array",
      overdueLoansCount: Array.isArray(overdueLoansArray)
        ? overdueLoansArray.length
        : "not array",
    });

    // Calculate dashboard metrics
    const totalClients = Array.isArray(clientsArray) ? clientsArray.length : 0;
    const activeClients = Array.isArray(clientsArray)
      ? clientsArray.filter((client: any) => client.active).length
      : 0;

    const totalLoans = Array.isArray(loansArray) ? loansArray.length : 0;
    const totalLoanAmount = Array.isArray(loansArray)
      ? loansArray.reduce(
          (sum: number, loan: any) => sum + (loan.principal || 0),
          0
        )
      : 0;

    // Extract currency information from the first loan (assuming all loans use same currency)
    const primaryCurrency =
      Array.isArray(loansArray) && loansArray.length > 0
        ? loansArray.find((loan: any) => loan.currency)?.currency
        : null;

    console.log("Primary currency found:", primaryCurrency);

    const pendingApprovals = Array.isArray(pendingLoansArray)
      ? pendingLoansArray.length
      : 0;
    const overdueCount = Array.isArray(overdueLoansArray)
      ? overdueLoansArray.length
      : 0;

    // Calculate portfolio distribution by loan product
    const portfolioByProduct: {
      [key: string]: { count: number; amount: number };
    } = {};
    if (Array.isArray(loansArray)) {
      loansArray.forEach((loan: any) => {
        const productName = loan.loanProductName || "Unknown";
        if (!portfolioByProduct[productName]) {
          portfolioByProduct[productName] = { count: 0, amount: 0 };
        }
        portfolioByProduct[productName].count += 1;
        portfolioByProduct[productName].amount += loan.principal || 0;
      });
    }

    // Calculate risk assessment based on loan status
    const riskAssessment = {
      low: 0,
      medium: 0,
      high: 0,
    };

    if (Array.isArray(loansArray)) {
      loansArray.forEach((loan: any) => {
        if (loan.status?.active && loan.summary?.totalOutstanding === 0) {
          riskAssessment.low += 1;
        } else if (loan.status?.active && loan.summary?.totalOverdue > 0) {
          riskAssessment.high += 1;
        } else if (loan.status?.active) {
          riskAssessment.medium += 1;
        }
      });
    }

    // Fetch recent leads from database
    let recentLeads: any[] = [];
    try {
      recentLeads = await prisma.lead.findMany({
        where: {
          status: {
            in: ["SUBMITTED", "DRAFT"],
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 10,
        select: {
          id: true,
          firstname: true,
          lastname: true,
          requestedAmount: true,
          loanPurpose: true,
          status: true,
          createdAt: true,
          submittedOnDate: true,
        },
      });
      console.log("Fetched leads from database:", recentLeads.length);
    } catch (error) {
      console.error("Error fetching leads:", error);
      recentLeads = [];
    }

    // Get recent loan applications from Fineract (last 5)
    const recentFineractLoans = Array.isArray(loansArray)
      ? loansArray
          .filter((loan: any) => loan.timeline?.submittedOnDate)
          .sort((a: any, b: any) => {
            const dateA = new Date(a.timeline.submittedOnDate);
            const dateB = new Date(b.timeline.submittedOnDate);
            return dateB.getTime() - dateA.getTime();
          })
          .slice(0, 5)
          .map((loan: any) => ({
            id: loan.id,
            clientName: loan.clientName,
            amount: loan.principal,
            productName: loan.loanProductName,
            status: loan.status?.value || "Unknown",
            submittedDate: loan.timeline?.submittedOnDate,
            type: "loan" as const,
            currency: loan.currency
              ? {
                  code: loan.currency.code,
                  displaySymbol: loan.currency.displaySymbol,
                }
              : undefined,
          }))
      : [];

    // Convert leads to application format
    const recentLeadApplications = recentLeads.slice(0, 5).map((lead: any) => ({
      id: lead.id,
      clientName:
        `${lead.firstname || ""} ${lead.lastname || ""}`.trim() || "Unknown",
      amount: lead.requestedAmount || 0,
      productName: lead.loanPurpose || "Personal Loan",
      status: lead.status === "SUBMITTED" ? "Pending Review" : "Draft",
      submittedDate: lead.submittedOnDate || lead.createdAt,
      type: "lead" as const,
      currency: primaryCurrency
        ? {
            code: primaryCurrency.code,
            displaySymbol: primaryCurrency.displaySymbol,
          }
        : undefined,
    }));

    // Combine and sort all applications by date
    const allApplications = [...recentFineractLoans, ...recentLeadApplications];
    const recentApplications = allApplications
      .sort((a: any, b: any) => {
        const dateA = new Date(a.submittedDate);
        const dateB = new Date(b.submittedDate);
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, 10);

    console.log("Calculated metrics:", {
      totalClients,
      activeClients,
      totalLoans,
      totalLoanAmount,
      pendingApprovals,
      overdueCount,
    });

    // Prepare dashboard data with real Fineract data
    const dashboardData: DashboardData = {
      summary: {
        totalLoans: {
          count: totalLoans,
          amount: totalLoanAmount,
          currency: primaryCurrency
            ? {
                code: primaryCurrency.code,
                name: primaryCurrency.name,
                decimalPlaces: primaryCurrency.decimalPlaces,
                displaySymbol: primaryCurrency.displaySymbol,
                displayLabel: primaryCurrency.displayLabel,
              }
            : undefined,
        },
        activeClients: activeClients,
        pendingApprovals: pendingApprovals,
        overdueLoans: overdueCount,
      },
      portfolioDistribution: Object.entries(portfolioByProduct).map(
        ([name, data]) => ({
          name,
          count: data.count,
          amount: data.amount,
        })
      ),
      riskAssessment: {
        low: riskAssessment.low,
        medium: riskAssessment.medium,
        high: riskAssessment.high,
        total: riskAssessment.low + riskAssessment.medium + riskAssessment.high,
      },
      recentApplications,
      loanProducts: Array.isArray(loanProducts) ? loanProducts.slice(0, 5) : [],
    };

    console.log("Final dashboard data:", dashboardData);
    return dashboardData;
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    // Return empty data structure on error
    return {
      summary: {
        totalLoans: { count: 0, amount: 0 },
        activeClients: 0,
        pendingApprovals: 0,
        overdueLoans: 0,
      },
      portfolioDistribution: [],
      riskAssessment: { low: 0, medium: 0, high: 0, total: 0 },
      recentApplications: [],
      loanProducts: [],
    };
  }
}
