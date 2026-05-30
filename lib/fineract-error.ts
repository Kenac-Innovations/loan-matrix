/**
 * Fineract error response structure (from Fineract API)
 */
interface FineractErrorItem {
  developerMessage?: string;
  defaultUserMessage?: string;
  userMessageGlobalisationCode?: string;
  parameterName?: string;
  args?: Array<{ value?: string }>;
}

interface FineractErrorResponse {
  developerMessage?: string;
  httpStatusCode?: string;
  defaultUserMessage?: string;
  userMessageGlobalisationCode?: string;
  errors?: FineractErrorItem[];
}

/**
 * Extracts the user-friendly error message from a Fineract or API error response.
 * Handles: { error }, { defaultUserMessage }, { errors: [{ defaultUserMessage }] },
 * { details: { errors } }, raw Fineract structure.
 *
 * @param body - Response body as string (JSON) or parsed object
 * @returns User-friendly error message
 */
export function parseFineractErrorResponse(body: string | object): string {
  let data: FineractErrorResponse & { error?: string; details?: { errors?: FineractErrorItem[] } };

  if (typeof body === "string") {
    try {
      data = JSON.parse(body) as FineractErrorResponse & {
        error?: string;
        details?: { errors?: FineractErrorItem[] };
      };
    } catch {
      return body.trim() || "An error occurred";
    }
  } else {
    data = body as FineractErrorResponse & {
      error?: string;
      details?: { errors?: FineractErrorItem[] };
    };
  }

  if (!data) {
    return "An error occurred";
  }

  // Check errors array first (Fineract structure)
  const errors = data.errors ?? data.details?.errors;
  if (errors && Array.isArray(errors) && errors.length > 0) {
    const firstError = errors[0];
    const msg =
      firstError.defaultUserMessage ??
      firstError.developerMessage;
    if (msg) return msg;
  }

  // Fallback: top-level fields (error can be string or { defaultUserMessage } from some APIs)
  if (data.defaultUserMessage) return data.defaultUserMessage;
  if (data.error) {
    if (typeof data.error === "string") return data.error;
    const errObj = data.error as { defaultUserMessage?: string };
    if (errObj?.defaultUserMessage) return errObj.defaultUserMessage;
  }
  return data.developerMessage ?? "An error occurred";
}

/**
 * Extracts the user-friendly error message from a caught Fineract API error
 * (thrown by fetchFineractAPI with errorData attached).
 *
 * @param error - Caught error from fetchFineractAPI or similar
 * @returns User-friendly error message
 */
export function getFineractErrorMessage(error: unknown): string {
  const err = error as {
    errorData?: { defaultUserMessage?: string };
    message?: string;
  };
  return (
    err?.errorData?.defaultUserMessage ??
    err?.message ??
    "An error occurred"
  );
}
