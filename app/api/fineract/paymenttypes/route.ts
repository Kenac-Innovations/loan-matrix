import { NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";

/**
 * GET /api/fineract/paymenttypes
 * Fetch all payment types from Fineract
 */
export async function GET() {
  try {
    const data = await fetchFineractAPI("/paymenttypes");
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching payment types:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
