import { getSearchHeaders } from "./fineract-search-auth";
import type { ClientServicingStatusResponse } from "./fineract-api";

/**
 * Reads a client's servicing status with the service account.
 *
 * Used when a branch-restricted user selects a client from another branch
 * (e.g. before transferring them): Fineract's office-hierarchy check refuses the
 * user's own request even though the status is needed to decide whether the
 * client may take a new loan. Only the current status and policies are returned;
 * the audit history stays behind the user's own access rights.
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

  const data = (await response.json()) as ClientServicingStatusResponse;
  return {
    clientId: data.clientId,
    assigned: data.assigned,
    status: data.status,
    policies: data.policies,
    history: [],
  };
}
