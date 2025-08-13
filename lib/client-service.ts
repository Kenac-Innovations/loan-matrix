import { fetchFineractAPI, fetchClientByExternalId } from './api';

export interface ClientDetails {
  id: number;
  accountNo: string;
  activationDate: string;
  active: boolean;
  displayName: string;
  emailAddress: string;
  externalId: string;
  firstname: string;
  lastname: string;
  officeId: number;
  officeName: string;
  status: {
    code: string;
    description: string;
    id: number;
  };
  timeline: {
    activatedByFirstname: string;
    activatedByLastname: string;
    activatedByUsername: string;
    activatedOnDate: string;
    submittedByFirstname: string;
    submittedByLastname: string;
    submittedByUsername: string;
    submittedOnDate: string;
  };
}

/**
 * Fetches client details by external ID (national ID)
 * @param externalId - The external ID (national ID) of the client
 * @returns Promise with the client details
 */
export async function getClientByExternalId(externalId: string): Promise<ClientDetails> {
  try {
    const data = await fetchClientByExternalId(externalId);
    return data;
  } catch (error) {
    console.error('Error in getClientByExternalId:', error);
    throw error;
  }
}

/**
 * Fetches client details by ID
 * @param clientId - The internal client ID
 * @returns Promise with the client details
 */
export async function getClientById(clientId: number): Promise<ClientDetails> {
  try {
    const data = await fetchFineractAPI(`/clients/${clientId}`);
    return data;
  } catch (error) {
    console.error('Error in getClientById:', error);
    throw error;
  }
}

/**
 * Searches for clients with optional filters
 * @param query - Search query string
 * @param offset - Pagination offset
 * @param limit - Pagination limit
 * @returns Promise with the search results
 */
export async function searchClients(
  query?: string,
  offset: number = 0,
  limit: number = 20
) {
  try {
    let endpoint = `/clients?offset=${offset}&limit=${limit}`;
    if (query) {
      endpoint = `/clients?search=${encodeURIComponent(query)}&offset=${offset}&limit=${limit}`;
    }
    
    const data = await fetchFineractAPI(endpoint);
    return data;
  } catch (error) {
    console.error('Error in searchClients:', error);
    throw error;
  }
}

/**
 * Creates a new client
 * @param clientData - The client data to create
 * @returns Promise with the created client
 */
export async function createClient(clientData: any) {
  try {
    const data = await fetchFineractAPI('/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clientData),
    });
    return data;
  } catch (error) {
    console.error('Error in createClient:', error);
    throw error;
  }
}

/**
 * Updates an existing client
 * @param clientId - The client ID to update
 * @param clientData - The updated client data
 * @returns Promise with the updated client
 */
export async function updateClient(clientId: number, clientData: any) {
  try {
    const data = await fetchFineractAPI(`/clients/${clientId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clientData),
    });
    return data;
  } catch (error) {
    console.error('Error in updateClient:', error);
    throw error;
  }
}
