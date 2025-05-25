import { NextRequest, NextResponse } from "next/server";
import {
  createPermissionHandler,
  createResourceAccessHandler,
} from "@/middleware/auth-middleware";
import { AccessLevel, Resource, SpecificPermission } from "@/types/auth";
import { fetchFineractAPI } from "@/lib/api";

// Handler for GET requests - list all clients
async function handleGetClients(req: NextRequest) {
  try {
    // Call the Fineract API to get all clients
    const response = await fetchFineractAPI("/clients");

    return NextResponse.json(response);
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
    const response = await fetchFineractAPI("/clients", {
      method: "POST",
      body: JSON.stringify(clientData),
    });

    return NextResponse.json(response, { status: 201 });
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
