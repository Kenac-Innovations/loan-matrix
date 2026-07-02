import { fetchFineractAPI } from "@/lib/api";

type LeadLoanStateLike = {
  fineractLoanId?: number | null;
  loanSubmittedToFineract?: boolean | null;
  stateMetadata?: Record<string, unknown> | null;
};

type LoanSearchLike = {
  id?: number | null;
  externalId?: string | null;
};

function toCleanString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toOptionalNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return null;
}

export function normalizeLoanSearchResults(
  response: unknown
): LoanSearchLike[] {
  if (Array.isArray(response)) {
    return response as LoanSearchLike[];
  }

  if (Array.isArray((response as { pageItems?: unknown })?.pageItems)) {
    return (response as { pageItems: LoanSearchLike[] }).pageItems;
  }

  if (Array.isArray((response as { content?: unknown })?.content)) {
    return (response as { content: LoanSearchLike[] }).content;
  }

  if (Array.isArray((response as { loans?: unknown })?.loans)) {
    return (response as { loans: LoanSearchLike[] }).loans;
  }

  return [];
}

export function resolveReusableUssdLoanId(input: {
  lead?: LeadLoanStateLike | null;
  externalId?: string | null;
  loansByExternalId?: LoanSearchLike[] | null;
}): number | null {
  const leadLoanId = toOptionalNumber(input.lead?.fineractLoanId);
  if (leadLoanId) {
    return leadLoanId;
  }

  const metadataLoanId = toOptionalNumber(
    input.lead?.stateMetadata?.loanId
  );
  if (metadataLoanId) {
    return metadataLoanId;
  }

  const externalId = toCleanString(input.externalId);
  if (!externalId) {
    return null;
  }

  const matchedLoan = (input.loansByExternalId ?? []).find(
    (loan) => toCleanString(loan.externalId) === externalId
  );

  return toOptionalNumber(matchedLoan?.id);
}

export function isDuplicateLoanCreationError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null
        ? String((error as { message?: unknown }).message ?? "")
        : String(error ?? "");

  if (message.toLowerCase().includes("already exists")) {
    return true;
  }

  const errorData = (error as { errorData?: Record<string, unknown> })
    ?.errorData;
  const candidates = [
    errorData?.defaultUserMessage,
    errorData?.developerMessage,
    errorData?.errors && Array.isArray(errorData.errors)
      ? (errorData.errors as Array<Record<string, unknown>>)
          .map((entry) =>
            [
              entry.defaultUserMessage,
              entry.developerMessage,
              entry.message,
            ]
              .map((value) => (typeof value === "string" ? value : ""))
              .join(" ")
          )
          .join(" ")
      : "",
  ]
    .map((value) => (typeof value === "string" ? value : ""))
    .join(" ")
    .toLowerCase();

  return candidates.includes("already exists");
}

export async function fetchLoansByExternalId(
  externalId: string
): Promise<LoanSearchLike[]> {
  const response = await fetchFineractAPI(
    `/loans?externalId=${encodeURIComponent(externalId)}`,
    { authMode: "service" }
  );

  return normalizeLoanSearchResults(response);
}

