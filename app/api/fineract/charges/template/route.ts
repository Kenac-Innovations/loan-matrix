import { NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";

type FineractApiError = {
  status?: number;
  errorData?: unknown;
  message?: string;
};

function toFineractApiError(error: unknown): FineractApiError {
  if (typeof error !== "object" || error === null) {
    return { message: "Unexpected error" };
  }

  const candidate = error as Record<string, unknown>;
  return {
    status: typeof candidate.status === "number" ? candidate.status : undefined,
    errorData: candidate.errorData,
    message:
      typeof candidate.message === "string"
        ? candidate.message
        : "Unexpected error",
  };
}

/**
 * GET /api/fineract/charges/template
 * Fetch charge creation template from Fineract.
 */
export async function GET() {
  try {
    const data = await fetchFineractAPI("/charges/template");
    return NextResponse.json(data);
  } catch (error: unknown) {
    const apiError = toFineractApiError(error);
    console.error("Error fetching charge template:", error);
    if (apiError.status && apiError.errorData) {
      return NextResponse.json(apiError.errorData, { status: apiError.status });
    }
    return NextResponse.json(
      { error: apiError.message || "Failed to fetch charge template" },
      { status: 500 }
    );
  }
}
