export interface FineractErrorArg {
  value?: string;
}

export interface FineractErrorItem {
  developerMessage?: string;
  defaultUserMessage?: string;
  userMessageGlobalisationCode?: string;
  parameterName?: string;
  args?: FineractErrorArg[];
}

export interface FineractErrorResponse {
  developerMessage?: string;
  httpStatusCode?: string;
  defaultUserMessage?: string;
  userMessageGlobalisationCode?: string;
  errors?: FineractErrorItem[];
}

type ExtendedFineractErrorResponse = FineractErrorResponse & {
  error?: string | { defaultUserMessage?: string; developerMessage?: string };
  details?: FineractErrorResponse;
};

type NormalizeOptions = {
  status?: number;
  statusText?: string;
};

const GENERIC_WRAPPER_CODES = new Set([
  "validation.msg.domain.rule.violation",
  "validation.msg.validation.errors.exist",
  "error.msg.resource.not.found",
]);

const FRIENDLY_MESSAGE_BY_CODE: Record<string, string> = {
  "error.msg.document.save":
    "Document upload is temporarily unavailable. Please try again later or contact support.",
  "error.msg.document.file.too.big":
    "This document is too large to upload. Please choose a smaller file and try again.",
  "error.msg.datatable.data.not.found":
    "No information is available for this section yet.",
  "error.msg.datatable.not.found":
    "This section is not configured in Fineract yet.",
  "error.msg.resource.not.found": "The requested record could not be found.",
  "validation.msg.validation.errors.exist":
    "Please review the entered details and try again.",
  "validation.msg.domain.rule.violation":
    "This action could not be completed because it violates a business rule.",
};

function parseErrorBody(body: string | object): ExtendedFineractErrorResponse | null {
  if (typeof body === "string") {
    try {
      return JSON.parse(body) as ExtendedFineractErrorResponse;
    } catch {
      return body.trim()
        ? ({
            error: body.trim(),
          } as ExtendedFineractErrorResponse)
        : null;
    }
  }

  if (!body || typeof body !== "object") {
    return null;
  }

  return body as ExtendedFineractErrorResponse;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function getFallbackStatusMessage(options?: NormalizeOptions): string {
  const status = options?.status;
  const statusText = options?.statusText;

  if (status) {
    return `HTTP ${status}${statusText ? `: ${statusText}` : ""}`;
  }

  return "An error occurred";
}

function getPreferredRawMessage(error: FineractErrorItem | ExtendedFineractErrorResponse): string | undefined {
  if (isNonEmptyString(error.defaultUserMessage)) {
    return error.defaultUserMessage;
  }

  if (isNonEmptyString(error.developerMessage)) {
    return error.developerMessage;
  }

  return undefined;
}

function getFriendlyMessageForCode(
  code: string | undefined,
  rawMessage: string | undefined,
  options?: NormalizeOptions
): string {
  if (code && FRIENDLY_MESSAGE_BY_CODE[code]) {
    return FRIENDLY_MESSAGE_BY_CODE[code];
  }

  if (isNonEmptyString(rawMessage)) {
    return rawMessage;
  }

  return getFallbackStatusMessage(options);
}

function normalizeErrorItems(
  errors: FineractErrorItem[] | undefined,
  options?: NormalizeOptions
): FineractErrorItem[] | undefined {
  if (!Array.isArray(errors) || errors.length === 0) {
    return undefined;
  }

  return errors.map((item) => {
    const friendlyMessage = getFriendlyMessageForCode(
      item.userMessageGlobalisationCode,
      getPreferredRawMessage(item),
      options
    );

    return {
      ...item,
      defaultUserMessage: friendlyMessage,
      developerMessage: friendlyMessage,
    };
  });
}

function getTopLevelRawMessage(data: ExtendedFineractErrorResponse): string | undefined {
  if (isNonEmptyString(data.defaultUserMessage)) {
    return data.defaultUserMessage;
  }

  if (typeof data.error === "string" && isNonEmptyString(data.error)) {
    return data.error;
  }

  if (
    data.error &&
    typeof data.error === "object" &&
    isNonEmptyString(data.error.defaultUserMessage)
  ) {
    return data.error.defaultUserMessage;
  }

  if (
    data.error &&
    typeof data.error === "object" &&
    isNonEmptyString(data.error.developerMessage)
  ) {
    return data.error.developerMessage;
  }

  if (isNonEmptyString(data.developerMessage)) {
    return data.developerMessage;
  }

  return undefined;
}

export function normalizeFineractErrorPayload(
  body: string | object | undefined,
  options?: NormalizeOptions
): FineractErrorResponse {
  const parsed = parseErrorBody(body);
  const fallbackMessage = getFallbackStatusMessage(options);

  if (!parsed) {
    return {
      httpStatusCode: options?.status ? String(options.status) : undefined,
      defaultUserMessage: fallbackMessage,
      developerMessage: fallbackMessage,
      errors: [],
    };
  }

  const nestedErrors = parsed.errors ?? parsed.details?.errors;
  const normalizedErrors = normalizeErrorItems(nestedErrors, options) ?? [];
  const firstSpecificMessage = normalizedErrors[0]?.defaultUserMessage;
  const topLevelCode =
    parsed.userMessageGlobalisationCode ?? parsed.details?.userMessageGlobalisationCode;

  let topLevelMessage = getFriendlyMessageForCode(
    topLevelCode,
    getTopLevelRawMessage(parsed),
    options
  );

  if (GENERIC_WRAPPER_CODES.has(topLevelCode ?? "") && firstSpecificMessage) {
    topLevelMessage = firstSpecificMessage;
  }

  return {
    ...parsed.details,
    ...parsed,
    httpStatusCode:
      parsed.httpStatusCode ??
      parsed.details?.httpStatusCode ??
      (options?.status ? String(options.status) : undefined),
    userMessageGlobalisationCode: topLevelCode,
    defaultUserMessage: topLevelMessage || fallbackMessage,
    developerMessage: topLevelMessage || fallbackMessage,
    errors: normalizedErrors,
  };
}

/**
 * Extracts the user-friendly error message from a Fineract or API error response.
 */
export function parseFineractErrorResponse(body: string | object): string {
  const normalized = normalizeFineractErrorPayload(body);
  return normalized.defaultUserMessage || "An error occurred";
}

/**
 * Extracts the user-friendly error message from a caught Fineract API error
 * (thrown by fetchFineractAPI or Axios-backed Fineract service calls).
 */
export function getFineractErrorMessage(error: unknown): string {
  const err = error as {
    errorData?: FineractErrorResponse;
    response?: { data?: string | object };
    message?: string;
  };

  if (err?.errorData) {
    return (
      normalizeFineractErrorPayload(err.errorData).defaultUserMessage ||
      err.message ||
      "An error occurred"
    );
  }

  if (err?.response?.data) {
    return parseFineractErrorResponse(err.response.data);
  }

  return err?.message ?? "An error occurred";
}
