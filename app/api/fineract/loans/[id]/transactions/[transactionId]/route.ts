import { NextResponse } from 'next/server';
import { buildFineractErrorResponse } from '@/lib/fineract-route-error';
import { fetchFineractAPI } from '@/lib/api';

// POST /api/fineract/loans/:id/transactions/:transactionId?command=chargeback
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; transactionId: string }> }
) {
  try {
    const { id, transactionId } = await params;
    const { searchParams } = new URL(request.url);
    const command = searchParams.get('command') || 'chargeback';

    const body = await request.json();

    const endpoint = `/loans/${id}/transactions/${transactionId}?command=${encodeURIComponent(command)}`;
    const data = await fetchFineractAPI(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error posting loan transaction command:', error);
    return buildFineractErrorResponse(error);
  }
}


