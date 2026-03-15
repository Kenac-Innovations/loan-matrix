import { NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";

/**
 * GET /api/fineract/clients/addresses/template
 * Fetches the address template
 */
export async function GET(request: Request) {
  try {
    // Note: Fineract uses singular "client" not "clients" for addresses endpoint
    const data = await fetchFineractAPI(`/client/addresses/template`);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching address template:", error);
    return NextResponse.json(
      {
        error:
          error?.message ||
          error?.errorData?.defaultUserMessage ||
          "Failed to fetch address template",
        details: error?.errorData || null,
      },
      { status: error?.status || 500 }
    );
  }
}
