import { NextResponse } from 'next/server';
import { buildFineractErrorResponse } from '@/lib/fineract-route-error';
import { fetchFineractAPI } from '@/lib/api';

/**
 * GET /api/fineract/loans/[id]/guarantors
 * Proxies to Fineract's loan guarantors endpoint
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await fetchFineractAPI(`/loans/${id}?associations=guarantors`, {
      authMode: "service",
    });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching loan guarantors:', error);
    return buildFineractErrorResponse(error);
  }
}

/**
 * POST /api/fineract/loans/[id]/guarantors
 * Creates a new guarantor for a loan
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const payload = await request.json();
    const data = await fetchFineractAPI(`/loans/${id}/guarantors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Error creating guarantor:', error);
    return buildFineractErrorResponse(error);
  }
}
