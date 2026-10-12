import { NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";
import { buildFineractErrorResponse } from "@/lib/fineract-route-error";

export async function GET() {
  try {
    const data = await fetchFineractAPI("/holidays/template", {
      authMode: "service",
      cache: "no-store",
    });
    return NextResponse.json(data);
  } catch (error) {
    return buildFineractErrorResponse(error, { action: "load", resource: "holiday template" });
  }
}
