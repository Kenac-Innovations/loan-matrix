import { NextRequest, NextResponse } from "next/server";
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
 * GET /api/fineract/charges
 * Fetch all charge definitions from Fineract.
 */
export async function GET() {
  try {
    const data = await fetchFineractAPI("/charges", { method: "GET" });
    return NextResponse.json(data);
  } catch (error: unknown) {
    const apiError = toFineractApiError(error);
    console.error("Error fetching charges:", error);
    if (apiError.status && apiError.errorData) {
      return NextResponse.json(apiError.errorData, { status: apiError.status });
    }
    return NextResponse.json(
      { error: apiError.message || "Failed to fetch charges" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/fineract/charges
 * Create a charge definition in Fineract.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = await fetchFineractAPI("/charges", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return NextResponse.json(data);
  } catch (error: unknown) {
    const apiError = toFineractApiError(error);
    console.error("Error creating charge:", error);
    if (apiError.status && apiError.errorData) {
      return NextResponse.json(apiError.errorData, { status: apiError.status });
    }
    return NextResponse.json(
      { error: apiError.message || "Failed to create charge" },
      { status: 500 }
    );
  }
}
