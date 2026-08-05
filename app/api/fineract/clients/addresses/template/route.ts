import { NextResponse } from "next/server";
import { buildFineractErrorResponse } from "@/lib/fineract-route-error";
import { fetchFineractAPI } from "@/lib/api";

/**
 * GET /api/fineract/clients/addresses/template
 * Fetches the address template
 */
export async function GET(request: Request) {
  try {
    // Note: Fineract uses singular "client" not "clients" for addresses endpoint
    const data = await fetchFineractAPI(`/client/addresses/template`, {
      authMode: "service",
    });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching address template:", error);
    return buildFineractErrorResponse(error);
  }
}
