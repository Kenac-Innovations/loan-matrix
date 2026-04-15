import { NextRequest, NextResponse } from "next/server";
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
    const data = await fetchFineractAPI("/loanproducts");
    return NextResponse.json(data);
  } catch (error: unknown) {
    const apiError = toFineractApiError(error);
    console.error("Error fetching loan products:", error);
    if (apiError.status && apiError.errorData) {
      return NextResponse.json(apiError.errorData, { status: apiError.status });
    }
    return NextResponse.json(
      { error: apiError.message || "Failed to fetch loan products" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = await fetchFineractAPI("/loanproducts", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return NextResponse.json(data, { status: 201 });
  } catch (error: unknown) {
    const apiError = toFineractApiError(error);
    console.error("Error creating loan product:", error);
    if (apiError.status && apiError.errorData) {
      return NextResponse.json(apiError.errorData, { status: apiError.status });
    }
    return NextResponse.json(
      { error: apiError.message || "Failed to create loan product" },
      { status: 500 }
    );
  }
}
