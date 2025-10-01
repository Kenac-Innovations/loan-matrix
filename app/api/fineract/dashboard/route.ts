import { NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";

/**
 * GET /api/fineract/dashboard
 * Aggregates dashboard data from multiple Fineract endpoints
 */
export async function GET(request: Request) {
  try {
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

    // Calculate dashboard metrics
    const totalClients = Array.isArray(clients) ? clients.length : 0;
    const activeClients = Array.isArray(clients)
      ? clients.filter((client: any) => client.active).length
      : 0;

    const totalLoans = Array.isArray(loans) ? loans.length : 0;
    const totalLoanAmount = Array.isArray(loans)
      ? loans.reduce((sum: number, loan: any) => sum + (loan.principal || 0), 0)
      : 0;

    const pendingApprovals = Array.isArray(pendingLoans)
      ? pendingLoans.length
      : 0;
    const overdueCount = Array.isArray(overdueLoans) ? overdueLoans.length : 0;

    // Calculate portfolio distribution by loan product
    const portfolioByProduct: {
      [key: string]: { count: number; amount: number };
    } = {};
    if (Array.isArray(loans)) {
      loans.forEach((loan: any) => {
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

    if (Array.isArray(loans)) {
      loans.forEach((loan: any) => {
        if (loan.status?.active && loan.summary?.totalOutstanding === 0) {
          riskAssessment.low += 1;
        } else if (loan.status?.active && loan.summary?.totalOverdue > 0) {
          riskAssessment.high += 1;
        } else if (loan.status?.active) {
          riskAssessment.medium += 1;
        }
      });
    }

    // Get recent loan applications (last 10)
    const recentApplications = Array.isArray(loans)
      ? loans
          .filter((loan: any) => loan.timeline?.submittedOnDate)
          .sort((a: any, b: any) => {
            const dateA = new Date(a.timeline.submittedOnDate);
            const dateB = new Date(b.timeline.submittedOnDate);
            return dateB.getTime() - dateA.getTime();
          })
          .slice(0, 10)
          .map((loan: any) => ({
            id: loan.id,
            clientName: loan.clientName,
            amount: loan.principal,
            productName: loan.loanProductName,
            status: loan.status?.value || "Unknown",
            submittedDate: loan.timeline?.submittedOnDate,
          }))
      : [];

    // Prepare dashboard data
    const dashboardData = {
      summary: {
        totalLoans: {
          count: totalLoans,
          amount: totalLoanAmount,
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

    return NextResponse.json(dashboardData);
  } catch (error: any) {
    console.error("Error fetching dashboard data:", error);
    return NextResponse.json(
      { error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
}
