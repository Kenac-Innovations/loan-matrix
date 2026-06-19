import { getSearchHeaders } from "./fineract-search-auth";

export function getClientDetailsPageFineractHeaders(
  tenantId: string,
  accept = "application/json"
): Record<string, string> {
  return {
    ...getSearchHeaders(tenantId),
    Accept: accept,
  };
}
