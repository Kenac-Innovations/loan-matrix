import { NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";

/**
 * GET /api/fineract/clients/[id]/identifiers/template
 * Fetches the template for adding client identifiers (identity documents)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log("Fetching identifiers template for client:", id);
    const data = await fetchFineractAPI(`/clients/${id}/identifiers/template`);
    console.log(
      "Identifiers template response:",
      JSON.stringify(data, null, 2)
    );
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching client identifiers template:", error);
    console.error("Error details:", {
      status: error?.status,
      message: error?.message,
      errorData: error?.errorData,
    });
    return NextResponse.json(
      {
        error:
          error?.message ||
          error?.errorData?.defaultUserMessage ||
          "Failed to fetch identifiers template",
        details: error?.errorData || null,
      },
      { status: error?.status || 500 }
    );
  }
}
