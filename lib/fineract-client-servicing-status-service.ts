import { getSearchHeaders } from "./fineract-search-auth";
import type { ClientServicingStatusResponse } from "./fineract-api";

/**
 * Reads a client's servicing status with the service account.
 *
 * Servicing status is read with the service account by default: Fineract's
 * office-hierarchy check otherwise refuses branch-restricted users for clients
 * from other branches (e.g. a "Different Branch" client selected on the new lead
 * form before transfer), even though the status decides whether the client may
 * take a new loan. Changing a status still uses the user's own credentials.
 */
export async function getClientServicingStatusWithServiceAuth(args: {
  baseUrl: string;
  tenantId: string;
  clientId: number;
  fetchImpl?: typeof fetch;
}): Promise<ClientServicingStatusResponse> {
  const fetcher = args.fetchImpl ?? fetch;
  const response = await fetcher(
    `${args.baseUrl}/fineract-provider/api/v1/client-servicing-statuses/clients/${args.clientId}`,
    {
      method: "GET",
      headers: getSearchHeaders(args.tenantId),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const details = await response.json().catch(() => null);
    const error = new Error(
      details?.defaultUserMessage ||
        details?.errors?.[0]?.defaultUserMessage ||
        `Fineract client servicing status API error ${response.status}`
    ) as Error & { status?: number; errorData?: unknown };
    error.status = response.status;
    error.errorData = details;
    throw error;
  }

  return (await response.json()) as ClientServicingStatusResponse;
}
