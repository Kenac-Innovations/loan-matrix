import { NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";
import { buildFineractErrorResponse } from "@/lib/fineract-route-error";

/**
 * GET /api/fineract/currencies
 * Fetch all currencies from Fineract
 */
export async function GET() {
  try {
    const data = await fetchFineractAPI("/currencies");
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching currencies:", error);
    return buildFineractErrorResponse(error);
  }
}
