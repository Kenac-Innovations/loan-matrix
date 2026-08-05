import { NextResponse } from "next/server";
import { buildFineractErrorResponse } from "@/lib/fineract-route-error";
import { fetchFineractAPI } from "@/lib/api";

/**
 * GET /api/fineract/fieldconfiguration/[entity]
 * Fetches field configuration for a specific entity (e.g., ADDRESS)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ entity: string }> }
) {
  try {
    const { entity } = await params;
    const data = await fetchFineractAPI(`/fieldconfiguration/${entity}`);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error(`Error fetching field configuration for ${entity}:`, error);
    return buildFineractErrorResponse(error);
  }
}









