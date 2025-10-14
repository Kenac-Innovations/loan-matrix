import { NextResponse } from "next/server";
import { getFineractServiceWithSession } from "@/lib/fineract-api";

/**
 * GET /api/fineract/clients-metrics
 * Gets client metrics and statistics
 */
export async function GET() {
  try {
    console.log("Client Metrics API: Starting metrics calculation");

    const fineractService = await getFineractServiceWithSession();

    // Fetch all clients for metrics calculation
    console.log("Client Metrics API: Fetching clients");
    const clients = await fineractService.getClients(0, 1000);
    console.log("Client Metrics API: Fetched clients:", {
      count: Array.isArray(clients) ? clients.length : "Not an array",
      type: typeof clients,
    });

    // Calculate metrics
    const totalClients = Array.isArray(clients) ? clients.length : 0;
    const activeClients = Array.isArray(clients)
      ? clients.filter((client: any) => client.active).length
      : 0;
    const inactiveClients = totalClients - activeClients;

    // Calculate new clients this month
    const currentDate = new Date();
    const firstDayOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1
    );
    const newClientsThisMonth = Array.isArray(clients)
      ? clients.filter((client: any) => {
          const submittedDate = new Date(
            client.timeline?.submittedOnDate || client.activationDate
          );
          return submittedDate >= firstDayOfMonth;
        }).length
      : 0;

    // Calculate growth rate
    const clientGrowthRate =
      newClientsThisMonth > 0
        ? (newClientsThisMonth /
            Math.max(totalClients - newClientsThisMonth, 1)) *
          100
        : 0;

    // Fetch loans for portfolio calculations
    console.log("Client Metrics API: Fetching loans");
    const loans = await fineractService.getLoans(0, 1000);
    console.log("Client Metrics API: Fetched loans:", {
      count: Array.isArray(loans) ? loans.length : "Not an array",
      type: typeof loans,
    });

    const totalPortfolioValue = Array.isArray(loans)
      ? loans.reduce((sum: number, loan: any) => sum + (loan.principal || 0), 0)
      : 0;
    const averageLoanAmount =
      Array.isArray(loans) && loans.length > 0
        ? totalPortfolioValue / loans.length
        : 0;

    // Calculate risk clients (clients with overdue loans)
    // Note: This is a simplified calculation - in reality you'd need to check loan status
    const riskClients = 0; // Placeholder - would need to implement proper risk calculation

    const metrics = {
      totalClients,
      activeClients,
      inactiveClients,
      newClientsThisMonth,
      totalPortfolioValue,
      averageLoanAmount,
      clientGrowthRate: Math.round(clientGrowthRate * 10) / 10,
      riskClients,
    };

    console.log("Client Metrics API: Calculated metrics:", metrics);

    return NextResponse.json(metrics);
  } catch (error: any) {
    console.error("Error fetching client metrics:", error);

    // Return mock data if Fineract is not available
    const mockMetrics = {
      totalClients: 0,
      activeClients: 0,
      inactiveClients: 0,
      newClientsThisMonth: 0,
      totalPortfolioValue: 0,
      averageLoanAmount: 0,
      clientGrowthRate: 0,
      riskClients: 0,
    };

    console.log("Client Metrics API: Returning mock data due to error");
    return NextResponse.json(mockMetrics);
  }
}
