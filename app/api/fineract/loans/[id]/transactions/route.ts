import { NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';

/**
 * POST /api/fineract/loans/[id]/transactions
 * Proxies to Fineract's loan transactions endpoint
 */
export async function POST(
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

    const body = await request.json();
    const data = await fetchFineractAPI(`/loans/${id}/transactions?command=${command}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error submitting loan transaction:', error);
    
    // Check if it's an API error with status and errorData
    if (error.status && error.errorData) {
      return NextResponse.json(
        { 
          error: error.message,
          status: error.status,
          details: error.errorData 
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