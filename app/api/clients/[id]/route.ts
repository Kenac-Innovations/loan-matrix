import { NextRequest, NextResponse } from "next/server";
import {
  createPermissionHandler,
  createResourceAccessHandler,
} from "@/middleware/auth-middleware";
import { AccessLevel, Resource, SpecificPermission } from "@/types/auth";
import { fetchFineractAPI } from "@/lib/api";

// Handler for GET requests - get a specific client
async function handleGetClient(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const clientId = params.id;

    // Call the Fineract API to get the client
    const response = await fetchFineractAPI(`/clients/${clientId}`);

    return NextResponse.json(response);
  } catch (error) {
    console.error(`Failed to get client ${params.id}:`, error);
    return NextResponse.json(
      { error: `Failed to get client ${params.id}` },
      { status: 500 }
    );
  }
}

// Handler for PUT requests - update a client
async function handleUpdateClient(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const clientId = params.id;
    const data = await req.json();

    // Format the data for the Fineract API
    const clientData = {
      ...(data.firstname && { firstname: data.firstname }),
      ...(data.lastname && { lastname: data.lastname }),
      ...(data.middlename && { middlename: data.middlename }),
      ...(data.mobileNo && { mobileNo: data.mobileNo }),
      ...(data.emailAddress && { emailAddress: data.emailAddress }),
      ...(data.dateOfBirth && { dateOfBirth: data.dateOfBirth }),
      ...(data.clientTypeId && { clientTypeId: data.clientTypeId }),
      ...(data.genderId && { genderId: data.genderId }),
      ...(data.externalId && { externalId: data.externalId }),
      dateFormat: "yyyy-MM-dd",
      locale: "en",
    };

    // Call the Fineract API to update the client
    const response = await fetchFineractAPI(`/clients/${clientId}`, {
      method: "PUT",
      body: JSON.stringify(clientData),
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error(`Failed to update client ${params.id}:`, error);
    return NextResponse.json(
      { error: `Failed to update client ${params.id}` },
      { status: 500 }
    );
  }
}

// Handler for DELETE requests - delete a client
async function handleDeleteClient(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const clientId = params.id;

    // Call the Fineract API to delete the client
    const response = await fetchFineractAPI(`/clients/${clientId}`, {
      method: "DELETE",
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error(`Failed to delete client ${params.id}:`, error);
    return NextResponse.json(
      { error: `Failed to delete client ${params.id}` },
      { status: 500 }
    );
  }
}

// Create wrapper functions that match the expected signature
const getClientWrapper = (req: NextRequest) => {
  const url = new URL(req.url);
  const id = url.pathname.split("/").pop() || "";
  return handleGetClient(req, { params: { id } });
};

const updateClientWrapper = (req: NextRequest) => {
  const url = new URL(req.url);
  const id = url.pathname.split("/").pop() || "";
  return handleUpdateClient(req, { params: { id } });
};

const deleteClientWrapper = (req: NextRequest) => {
  const url = new URL(req.url);
  const id = url.pathname.split("/").pop() || "";
  return handleDeleteClient(req, { params: { id } });
};

// Export the handlers with authorization checks
export const GET = createResourceAccessHandler(
  Resource.CLIENT,
  AccessLevel.READ,
  getClientWrapper
);

export const PUT = createResourceAccessHandler(
  Resource.CLIENT,
  AccessLevel.WRITE,
  updateClientWrapper
);

export const DELETE = createPermissionHandler(
  SpecificPermission.DELETE_CLIENT,
  deleteClientWrapper
);
