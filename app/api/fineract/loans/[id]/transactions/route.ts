import { NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';

/**
 * POST /api/fineract/loans/[id]/transactions
 * Creates a new transaction for a specific loan (e.g., repayment)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const payload = await request.json();
    
    // Get the command parameter from the request body
    const command = payload.command || 'repayment';
    
    // Remove command from payload body as it should only be in URL
    const { command: _, ...requestBody } = payload;
    
    // Build the endpoint URL
    const endpoint = `/loans/${id}/transactions?command=${command}`;
    
    const data = await fetchFineractAPI(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
    
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error creating loan transaction:', error);
    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/fineract/loans/[id]/transactions
 * Gets all transactions for a specific loan
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    
    // Build query parameters
    const queryParams = new URLSearchParams();
    
    // Add offset and limit if provided
    const offset = searchParams.get('offset');
    const limit = searchParams.get('limit');
    
    if (offset) queryParams.append('offset', offset);
    if (limit) queryParams.append('limit', limit);
    
    // Build the endpoint URL
    const endpoint = `/loans/${id}/transactions${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const data = await fetchFineractAPI(endpoint);
    
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching loan transactions:', error);
    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
