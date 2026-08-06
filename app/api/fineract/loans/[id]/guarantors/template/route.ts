import { NextResponse } from 'next/server';
import { buildFineractErrorResponse } from '@/lib/fineract-route-error';
import { fetchFineractAPI } from '@/lib/api';

/**
 * GET /api/fineract/loans/[id]/guarantors/template
 * Proxies to Fineract's loan guarantors template endpoint
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await fetchFineractAPI(`/loans/${id}/guarantors/template`, {
      authMode: "service",
    });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching guarantors template:', error);
    return buildFineractErrorResponse(error);
  }
}
