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

export async function POST(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string; chargeId: string }>;
  }
) {
  try {
    const { id: loanId, chargeId } = await params;
    const body = await request.json().catch(() => ({}));
    const search = new URL(request.url).search;

    const data = await fetchFineractAPI(
      `/loans/${loanId}/charges/${chargeId}${search}`,
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    );

    return NextResponse.json(data);
  } catch (error: unknown) {
    const apiError = toFineractApiError(error);
    console.error("Error processing loan charge action:", error);
    if (apiError.status && apiError.errorData) {
      return NextResponse.json(apiError.errorData, { status: apiError.status });
    }
    return NextResponse.json(
      { error: apiError.message || "Failed to process loan charge action" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string; chargeId: string }>;
  }
) {
  try {
    const { id: loanId, chargeId } = await params;
    const body = await request.json();

    const data = await fetchFineractAPI(`/loans/${loanId}/charges/${chargeId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });

    return NextResponse.json(data);
  } catch (error: unknown) {
    const apiError = toFineractApiError(error);
    console.error("Error updating loan charge:", error);
    if (apiError.status && apiError.errorData) {
      return NextResponse.json(apiError.errorData, { status: apiError.status });
    }
    return NextResponse.json(
      { error: apiError.message || "Failed to update loan charge" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string; chargeId: string }>;
  }
) {
  try {
    const { id: loanId, chargeId } = await params;

    const data = await fetchFineractAPI(`/loans/${loanId}/charges/${chargeId}`, {
      method: "DELETE",
    });

    return NextResponse.json(data);
  } catch (error: unknown) {
    const apiError = toFineractApiError(error);
    console.error("Error deleting loan charge:", error);
    if (apiError.status && apiError.errorData) {
      return NextResponse.json(apiError.errorData, { status: apiError.status });
    }
    return NextResponse.json(
      { error: apiError.message || "Failed to delete loan charge" },
      { status: 500 }
    );
  }
}
