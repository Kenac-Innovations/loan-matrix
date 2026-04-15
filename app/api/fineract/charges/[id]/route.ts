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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await fetchFineractAPI(`/charges/${id}`, { method: "GET" });
    return NextResponse.json(data);
  } catch (error: unknown) {
    const apiError = toFineractApiError(error);
    console.error("Error fetching charge:", error);
    if (apiError.status && apiError.errorData) {
      return NextResponse.json(apiError.errorData, { status: apiError.status });
    }
    return NextResponse.json(
      { error: apiError.message || "Failed to fetch charge" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data = await fetchFineractAPI(`/charges/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return NextResponse.json(data);
  } catch (error: unknown) {
    const apiError = toFineractApiError(error);
    console.error("Error updating charge:", error);
    if (apiError.status && apiError.errorData) {
      return NextResponse.json(apiError.errorData, { status: apiError.status });
    }
    return NextResponse.json(
      { error: apiError.message || "Failed to update charge" },
      { status: 500 }
    );
  }
}
