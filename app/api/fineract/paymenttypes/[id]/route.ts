import { NextResponse } from "next/server";
import { buildFineractErrorResponse } from "@/lib/fineract-route-error";
import { fetchFineractAPI } from "@/lib/api";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const data = await fetchFineractAPI(`/paymenttypes/${id}`);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching payment type:", error);
    return buildFineractErrorResponse(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const data = await fetchFineractAPI(`/paymenttypes/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error updating payment type:", error);
    return buildFineractErrorResponse(error);
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const data = await fetchFineractAPI(`/paymenttypes/${id}`, {
      method: "DELETE",
    });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error deleting payment type:", error);
    return buildFineractErrorResponse(error);
  }
}
