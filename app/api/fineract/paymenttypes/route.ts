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

/**
 * POST /api/fineract/paymenttypes
 * Create a payment type in Fineract
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = await fetchFineractAPI("/paymenttypes", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error creating payment type:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create payment type" },
      { status: error.status || 500 }
    );
  }
}
