import { NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";

/**
 * GET /api/fineract/clients/[id]/identifiers
 * Fetches existing identifiers (identity documents) for a client
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await fetchFineractAPI(`/clients/${id}/identifiers`);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching client identifiers:", error);
    return NextResponse.json(
      {
        error:
          error?.message ||
          error?.errorData?.defaultUserMessage ||
          "Failed to fetch identifiers",
        details: error?.errorData || null,
      },
      { status: error?.status || 500 }
    );
  }
}

/**
 * POST /api/fineract/clients/[id]/identifiers
 * Creates a new identifier (identity document) for a client
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const data = await fetchFineractAPI(`/clients/${id}/identifiers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error("Error creating client identifier:", error);

    // Extract specific error message from Fineract response
    let errorMessage = "Failed to create identifier";

    if (error?.errorData) {
      // Check for errors array with specific messages
      if (
        error.errorData.errors &&
        Array.isArray(error.errorData.errors) &&
        error.errorData.errors.length > 0
      ) {
        errorMessage =
          error.errorData.errors[0].defaultUserMessage ||
          error.errorData.errors[0].developerMessage ||
          errorMessage;
      } else if (error.errorData.defaultUserMessage) {
        errorMessage = error.errorData.defaultUserMessage;
      } else if (error.errorData.developerMessage) {
        errorMessage = error.errorData.developerMessage;
      }
    } else if (error?.message) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: error?.errorData || null,
      },
      { status: error?.status || 500 }
    );
  }
}
