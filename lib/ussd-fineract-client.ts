import { fetchFineractAPI } from "./api";
import type {
  FineractClientLike,
  UssdApplicationLike,
} from "./ussd-lead-conversion";

function toCleanString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function resolveUssdApplicationFineractClient(
  application: UssdApplicationLike
): Promise<FineractClientLike | null> {
  if (application.loanMatrixClientId) {
    try {
      const clientById = await fetchFineractAPI(
        `/clients/${application.loanMatrixClientId}`,
        { authMode: "service" }
      );
      if (clientById) {
        return clientById as FineractClientLike;
      }
    } catch (error) {
      console.warn("Failed to load linked Fineract client by id:", error);
    }
  }

  const externalId = toCleanString(application.userNationalId);
  if (!externalId) {
    return null;
  }

  try {
    const searchPayload = {
      request: { text: externalId },
      page: 0,
      size: 50,
    };
    const searchData = await fetchFineractAPI(
      "/clients/search",
      {
        authMode: "service",
        method: "POST",
        body: JSON.stringify(searchPayload),
      },
      "v2"
    );

    const candidates = Array.isArray((searchData as any)?.content)
      ? (searchData as any).content
      : Array.isArray((searchData as any)?.pageItems)
        ? (searchData as any).pageItems
        : [];
    const exactMatch = candidates.find(
      (candidate: { externalId?: string | null }) =>
        toCleanString(candidate.externalId) === externalId
    );

    if (exactMatch?.id) {
      const clientByExternalId = await fetchFineractAPI(
        `/clients/${exactMatch.id}`,
        { authMode: "service" }
      );
      if (clientByExternalId) {
        return clientByExternalId as FineractClientLike;
      }
    }
  } catch (error) {
    console.warn("Failed to load linked Fineract client by external id:", error);
  }

  return null;
}
