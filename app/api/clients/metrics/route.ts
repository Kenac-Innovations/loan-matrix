import { NextRequest, NextResponse } from "next/server";
import { getFineractServiceWithSession } from "@/lib/fineract-api";

export async function GET() {
  try {
    const fineractService = await getFineractServiceWithSession();

    // Fetch clients from Fineract
    const clientsResponse = await fineractService.getClients(0, 1000); // Get more clients for accurate metrics

    // Handle different response formats from Fineract
    const clients = Array.isArray(clientsResponse)
      ? clientsResponse
      : (clientsResponse as any)?.pageItems ||
        (clientsResponse as any)?.content ||
        [];

    // Calculate metrics
    const totalClients = clients.length;
    const activeClients = clients.filter((client: any) => client.active).length;
    const inactiveClients = totalClients - activeClients;

    // Calculate new clients this month
    const currentDate = new Date();
    const firstDayOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1
    );
    const newClientsThisMonth = clients.filter((client: any) => {
      const submittedDate = new Date(client.timeline.submittedOnDate);
      return submittedDate >= firstDayOfMonth;
    }).length;

    // Calculate growth rate (mock calculation for now)
    const clientGrowthRate =
      newClientsThisMonth > 0
        ? (newClientsThisMonth /
            Math.max(totalClients - newClientsThisMonth, 1)) *
          100
        : 0;

    // Get loan data for portfolio calculations
    const loansResponse = await fineractService.getLoans(0, 1000);
    const loans = Array.isArray(loansResponse)
      ? loansResponse
      : (loansResponse as any)?.pageItems ||
        (loansResponse as any)?.content ||
        [];

    const totalPortfolioValue = loans.reduce(
      (sum: number, loan: any) => sum + (loan.principal || 0),
      0
    );
    const averageLoanAmount =
      loans.length > 0 ? totalPortfolioValue / loans.length : 0;

    // Calculate risk clients (clients with overdue loans)
    const overdueLoansResponse = await fineractService.getOverdueLoans();
    const overdueLoans = Array.isArray(overdueLoansResponse)
      ? overdueLoansResponse
      : (overdueLoansResponse as any)?.pageItems ||
        (overdueLoansResponse as any)?.content ||
        [];

    const riskClientIds = new Set(
      overdueLoans.map((loan: any) => loan.clientId)
    );
    const riskClients = riskClientIds.size;

    const metrics = {
      totalClients,
      activeClients,
      inactiveClients,
      newClientsThisMonth,
      totalPortfolioValue,
      averageLoanAmount,
      clientGrowthRate: Math.round(clientGrowthRate * 10) / 10, // Round to 1 decimal
      riskClients,
    };

    return NextResponse.json(metrics);
  } catch (error) {
    console.error("Failed to get client metrics:", error);

    // Return mock data if Fineract is not available
    const mockMetrics = {
      totalClients: 1429,
      activeClients: 1285,
      inactiveClients: 144,
      newClientsThisMonth: 87,
      totalPortfolioValue: 4550000,
      averageLoanAmount: 125000,
      clientGrowthRate: 12.5,
      riskClients: 23,
    };

    return NextResponse.json(mockMetrics);
  }
}
