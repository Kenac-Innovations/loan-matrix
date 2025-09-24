import { NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';

/**
 * POST /api/fineract/loans/[id]/disburse
 * Submits loan disbursement using Fineract command API
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const payload = await request.json();

    // POST to /loans/{id}?command=disburse with payload
    const data = await fetchFineractAPI(`/loans/${id}?command=disburse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error disbursing loan:', error);

    // Return structured backend error when available
    if (error.status && error.errorData) {
      return NextResponse.json(
        {
          error: error.message || 'API error',
          status: error.status,
          errorData: error.errorData,
        },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}


