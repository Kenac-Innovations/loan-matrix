import { NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";

/**
 * GET /api/fineract/loans
 * Proxies to Fineract's loans endpoint
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const offset = searchParams.get("offset") || "0";
    const limit = searchParams.get("limit") || "100";
    const sqlSearch = searchParams.get("sqlSearch");
    const orderBy = searchParams.get("orderBy") || "id";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    let endpoint = `/loans?offset=${offset}&limit=${limit}&orderBy=${orderBy}&sortOrder=${sortOrder}`;

    if (sqlSearch) {
      endpoint += `&sqlSearch=${encodeURIComponent(sqlSearch)}`;
    }

    const data = await fetchFineractAPI(endpoint);

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching loans:", error);
    return NextResponse.json(
      { error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/fineract/loans
 * Creates a new loan in Fineract
 */
export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const data = await fetchFineractAPI("/loans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error("Error creating loan:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
