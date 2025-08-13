import { NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';

/**
 * GET /api/fineract/loans/[id]/transactions/template
 * Gets the repayment template for a specific loan
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    
    // Get the command parameter (should be 'repayment')
    const command = searchParams.get('command') || 'repayment';
    
    // Build the endpoint URL
    const endpoint = `/loans/${id}/transactions/template?command=${command}`;
    const data = await fetchFineractAPI(endpoint);
    
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching repayment template:', error);
    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
