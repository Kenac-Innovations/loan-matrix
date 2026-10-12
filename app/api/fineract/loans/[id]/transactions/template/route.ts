import { NextResponse } from 'next/server';
import { buildFineractErrorResponse } from '@/lib/fineract-route-error';
import { fetchFineractAPI } from '@/lib/api';

/**
 * GET /api/fineract/loans/[id]/transactions/template
 * Proxies to Fineract's loan transaction template endpoint
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const command = searchParams.get('command');

    if (!command) {
      return NextResponse.json(
        { error: 'Command parameter is required' },
        { status: 400 }
      );
    }

    const data = await fetchFineractAPI(`/loans/${id}/transactions/template?command=${command}`, {
      authMode: "service",
    });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching loan transaction template:', error);
    return buildFineractErrorResponse(error);
  }
}
