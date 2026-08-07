import { NextRequest, NextResponse } from "next/server";
import { buildFineractErrorResponse } from "@/lib/fineract-route-error";
import { fetchFineractAPI } from "@/lib/api";

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
    console.error("Error processing loan charge action:", error);
    return buildFineractErrorResponse(error, {
      action: "process",
      resource: "loan charge",
    });
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
    console.error("Error updating loan charge:", error);
    return buildFineractErrorResponse(error, {
      action: "update",
      resource: "loan charge",
    });
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
    console.error("Error deleting loan charge:", error);
    return buildFineractErrorResponse(error, {
      action: "delete",
      resource: "loan charge",
    });
  }
}
