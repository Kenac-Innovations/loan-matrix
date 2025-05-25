"use server";

import {
  withPermissionAction,
  withResourceAccessAction,
  isAuthError,
} from "@/lib/auth-actions";
import { AccessLevel, Resource, SpecificPermission } from "@/types/auth";
import { fetchFineractAPI } from "@/lib/api";
import { revalidatePath } from "next/cache";

// Original client creation action
async function createClientAction(data: any) {
  try {
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

    // Revalidate the clients page to show the new client
    revalidatePath("/clients");
    revalidatePath("/leads");

    return {
      success: true,
      data: response,
    };
  } catch (error) {
    console.error("Failed to create client:", error);
    return {
      success: false,
      error: "Failed to create client",
    };
  }
}

// Original client update action
async function updateClientAction(clientId: number, data: any) {
  try {
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

    // Revalidate the clients page to show the updated client
    revalidatePath("/clients");
    revalidatePath(`/clients/${clientId}`);
    revalidatePath("/leads");

    return {
      success: true,
      data: response,
    };
  } catch (error) {
    console.error(`Failed to update client ${clientId}:`, error);
    return {
      success: false,
      error: `Failed to update client ${clientId}`,
    };
  }
}

// Original client deletion action
async function deleteClientAction(clientId: number) {
  try {
    // Call the Fineract API to delete the client
    const response = await fetchFineractAPI(`/clients/${clientId}`, {
      method: "DELETE",
    });

    // Revalidate the clients page to remove the deleted client
    revalidatePath("/clients");
    revalidatePath("/leads");

    return {
      success: true,
      data: response,
    };
  } catch (error) {
    console.error(`Failed to delete client ${clientId}:`, error);
    return {
      success: false,
      error: `Failed to delete client ${clientId}`,
    };
  }
}

// Original client retrieval action
async function getClientAction(clientId: number) {
  try {
    // Call the Fineract API to get the client
    const response = await fetchFineractAPI(`/clients/${clientId}`);

    return {
      success: true,
      data: response,
    };
  } catch (error) {
    console.error(`Failed to get client ${clientId}:`, error);
    return {
      success: false,
      error: `Failed to get client ${clientId}`,
    };
  }
}

// Original clients list retrieval action
async function getClientsAction() {
  try {
    // Call the Fineract API to get all clients
    const response = await fetchFineractAPI("/clients");

    return {
      success: true,
      data: response,
    };
  } catch (error) {
    console.error("Failed to get clients:", error);
    return {
      success: false,
      error: "Failed to get clients",
    };
  }
}

// Wrap the actions with authorization checks

// Create client with permission check
export const createClient = withPermissionAction(
  SpecificPermission.CREATE_CLIENT,
  createClientAction
);

// Update client with resource access check
// We need to create a wrapper function to handle the multiple parameters
export const updateClient = (clientId: number, data: any) => {
  const wrappedAction = withResourceAccessAction(
    Resource.CLIENT,
    AccessLevel.WRITE,
    (params: { clientId: number; data: any }) =>
      updateClientAction(params.clientId, params.data)
  );

  return wrappedAction({ clientId, data });
};

// Delete client with permission check
// We need to create a wrapper function to handle the single parameter
export const deleteClient = (clientId: number) => {
  const wrappedAction = withPermissionAction(
    SpecificPermission.DELETE_CLIENT,
    (params: number) => deleteClientAction(params)
  );

  return wrappedAction(clientId);
};

// Get client with resource access check
// We need to create a wrapper function to handle the single parameter
export const getClient = (clientId: number) => {
  const wrappedAction = withResourceAccessAction(
    Resource.CLIENT,
    AccessLevel.READ,
    (params: number) => getClientAction(params)
  );

  return wrappedAction(clientId);
};

// Get clients with resource access check
export const getClients = withResourceAccessAction(
  Resource.CLIENT,
  AccessLevel.READ,
  getClientsAction
);

// Example of how to use these actions in a component:
/*
import { createClient, isAuthError } from "@/app/actions/client-actions-with-auth";

async function handleCreateClient(data) {
  const result = await createClient(data);
  
  if (isAuthError(result)) {
    // Handle authorization error
    console.error("Authorization error:", result.error);
    return;
  }
  
  if (!result.success) {
    // Handle other errors
    console.error("Error:", result.error);
    return;
  }
  
  // Handle success
  console.log("Client created:", result.data);
}
*/
