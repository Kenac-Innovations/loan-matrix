import { NextRequest, NextResponse } from "next/server";
import {
  createPermissionHandler,
  createResourceAccessHandler,
} from "@/middleware/auth-middleware";
import { AccessLevel, Resource, SpecificPermission } from "@/types/auth";
import { getFineractServiceWithSession } from "@/lib/fineract-api";

// Handler for GET requests - list all clients
async function handleGetClients(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query");
    const offset = parseInt(searchParams.get("offset") || "0");
    const limit = parseInt(searchParams.get("limit") || "100");

    const fineractService = await getFineractServiceWithSession();

    // Use v2 search endpoint if query is provided, otherwise get all clients
    const clientsResponse = query
      ? await fineractService.searchClientsV2(query, offset, limit)
      : await fineractService.getClients(offset, limit);

    // Handle different response formats from Fineract
    const clients = Array.isArray(clientsResponse)
      ? clientsResponse
      : (clientsResponse as any)?.pageItems ||
        (clientsResponse as any)?.content ||
        [];

    // Return paginated response with metadata
    const totalCount = Array.isArray(clientsResponse)
      ? clientsResponse.length
      : (clientsResponse as any)?.totalFilteredRecords || clients.length;

    return NextResponse.json({
      data: clients,
      pagination: {
        offset,
        limit,
        total: totalCount,
        hasMore: clients.length === limit,
      },
    });
  } catch (error) {
    console.error("Failed to get clients:", error);
    return NextResponse.json(
      { error: "Failed to get clients" },
      { status: 500 }
    );
  }
}

// Handler for POST requests - create a new client
async function handleCreateClient(req: NextRequest) {
  try {
    const data = await req.json();

    // Format the data for the Fineract API
    const clientData = {
      officeId: data.officeId,
      legalFormId: data.legalFormId,
      fullname: `${data.firstname} ${data.lastname}`,
      firstname: data.firstname,
      lastname: data.lastname,
      ...(data.middlename && { middlename: data.middlename }),
      mobileNo: data.mobileNo,
      emailAddress: data.emailAddress,
      dateOfBirth: data.dateOfBirth,
      clientTypeId: data.clientTypeId,
      genderId: data.genderId,
      ...(data.externalId && { externalId: data.externalId }),
      active: data.active || false,
      ...(data.active && {
        activationDate: new Date().toISOString().split("T")[0],
      }),
      dateFormat: "yyyy-MM-dd",
      locale: "en",
      submittedOnDate: new Date().toISOString().split("T")[0],
    };

    // Call the Fineract API to create the client
    const fineractService = await getFineractServiceWithSession();
    // Note: This would need a createClient method in the service
    // For now, we'll return an error as client creation needs to be implemented
    throw new Error("Client creation not yet implemented in Fineract service");
  } catch (error) {
    console.error("Failed to create client:", error);
    return NextResponse.json(
      { error: "Failed to create client" },
      { status: 500 }
    );
  }
}

// Export the handlers with authorization checks
export const GET = createResourceAccessHandler(
  Resource.CLIENT,
  AccessLevel.READ,
  handleGetClients
);

export const POST = createPermissionHandler(
  SpecificPermission.CREATE_CLIENT,
  handleCreateClient
);
