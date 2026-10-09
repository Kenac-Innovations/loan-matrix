import { NextResponse } from "next/server";
import {
  getFineractErrorMessage,
  normalizeFineractErrorPayload,
  type FineractErrorMessageContext,
  type FineractErrorResponse,
} from "./fineract-error";

type FineractRouteErrorLike = {
  status?: number;
  errorData?: string | object | FineractErrorResponse | null;
  response?: {
    data?: string | object;
    status?: number;
    statusText?: string;
  };
};

export function createFineractErrorResponsePayload(
  error: unknown,
  context: FineractErrorMessageContext = {}
) {
  const fineractError = error as FineractRouteErrorLike;
  const status =
    typeof fineractError?.status === "number"
      ? fineractError.status
      : typeof fineractError?.response?.status === "number"
        ? fineractError.response.status
        : 500;

  const details = normalizeFineractErrorPayload(
    fineractError?.errorData ?? fineractError?.response?.data,
    {
      ...context,
      status,
      statusText: fineractError?.response?.statusText,
    }
  );

  return {
    status,
    body: {
      error: details.defaultUserMessage || getFineractErrorMessage(error, context),
      details,
    },
  };
}

export function buildFineractErrorResponse(
  error: unknown,
  context: FineractErrorMessageContext = {}
) {
  const responsePayload = createFineractErrorResponsePayload(error, context);
  return NextResponse.json(responsePayload.body, {
    status: responsePayload.status,
  });
}
