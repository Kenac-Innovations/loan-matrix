import { NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";

type FineractApiError = {
  status?: number;
  errorData?: unknown;
  message?: string;
};

function toFineractApiError(error: unknown): FineractApiError {
  if (typeof error !== "object" || error === null) return { message: "Unexpected error" };
  const c = error as Record<string, unknown>;
  return {
    status: typeof c.status === "number" ? c.status : undefined,
    errorData: c.errorData,
    message: typeof c.message === "string" ? c.message : "Unexpected error",
  };
}

export async function GET() {
  try {
    const data = await fetchFineractAPI("/loanproducts/template");
    return NextResponse.json(data);
  } catch (error: unknown) {
    const apiError = toFineractApiError(error);
    console.error("Error fetching loan product template:", error);
    if (apiError.status && apiError.errorData) {
      return NextResponse.json(apiError.errorData, { status: apiError.status });
    }
    return NextResponse.json(
      { error: apiError.message || "Failed to fetch loan product template" },
      { status: 500 }
    );
  }
}
