import { NextRequest, NextResponse } from "next/server";
import { getFineractService } from "@/lib/fineract-api";

export async function GET(request: NextRequest) {
  try {
    const fineractService = getFineractService("");

    // Test basic connection
    console.log("Testing Fineract connection...");

    // Get basic info
    const offices = await fineractService.getOffices();
    console.log("Offices:", offices);

    // Get clients with detailed logging
    const clients = await fineractService.getClients(0, 100);
    console.log("Clients found:", clients.length);

    // Get client count
    const clientCount = await fineractService.getClientsCount();
    console.log("Client count:", clientCount);

    // Get all clients
    const allClients = await fineractService.getAllClients();
    console.log("All clients found:", allClients.length);

    // Test health check
    const isHealthy = await fineractService.healthCheck();

    return NextResponse.json({
      success: true,
      connection: {
        baseUrl: process.env.FINERACT_BASE_URL,
        tenantId: process.env.FINERACT_TENANT_ID,
        username: process.env.FINERACT_USERNAME,
        isHealthy,
      },
      data: {
        officesCount: offices.length,
        offices: offices.map((office) => ({
          id: office.id,
          name: office.name,
          externalId: office.externalId,
        })),
        clientsFromGetClients: clients.length,
        clientsFromGetClientsCount: clientCount,
        clientsFromGetAllClients: allClients.length,
        sampleClients: clients.slice(0, 5).map((client) => ({
          id: client.id,
          accountNo: client.accountNo,
          displayName: client.displayName,
          officeName: client.officeName,
          active: client.active,
        })),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Fineract connection test failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
          config: {
            baseUrl: error.config?.baseURL,
            url: error.config?.url,
            headers: error.config?.headers,
          },
        },
        connection: {
          baseUrl: process.env.FINERACT_BASE_URL,
          tenantId: process.env.FINERACT_TENANT_ID,
          username: process.env.FINERACT_USERNAME,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
