import { NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';

/**
 * GET /api/fineract/clients/[id]/loans
 * Gets loans for a specific client
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const offset = searchParams.get('offset') || '0';
    const limit = searchParams.get('limit') || '20';

    // Try different possible Fineract endpoints for client loans
    let data;
    let error;
    
    // First try the standard loans endpoint with client filter
    try {
      const endpoint = `/loans?clientId=${id}&offset=${offset}&limit=${limit}`;
      data = await fetchFineractAPI(endpoint);
    } catch (e: any) {
      error = e;
      console.log('First endpoint failed, trying alternative...');
      
      // Try alternative endpoint
      try {
        const endpoint = `/clients/${id}/loans?offset=${offset}&limit=${limit}`;
        data = await fetchFineractAPI(endpoint);
      } catch (e2: any) {
        error = e2;
        console.log('Second endpoint failed, trying loans endpoint...');
        
        // Try the general loans endpoint
        try {
          const endpoint = `/loans?offset=${offset}&limit=${limit}`;
          data = await fetchFineractAPI(endpoint);
          
          // Filter by client ID if we get all loans
          if (data && Array.isArray(data.pageItems)) {
            data.pageItems = data.pageItems.filter((loan: any) => loan.clientId == id);
          }
        } catch (e3: any) {
          error = e3;
          throw e3;
        }
      }
    }
    
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching client loans:', error);
    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
} 