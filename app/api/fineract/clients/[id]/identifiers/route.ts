import { NextResponse } from "next/server";
import { buildFineractErrorResponse } from "@/lib/fineract-route-error";
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
    const data = await fetchFineractAPI(`/clients/${id}/identifiers`, {
      authMode: "service",
    });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching client identifiers:", error);
    return buildFineractErrorResponse(error);
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
    return buildFineractErrorResponse(error, {
      action: "create",
      resource: "client identifier",
    });
  }
}
