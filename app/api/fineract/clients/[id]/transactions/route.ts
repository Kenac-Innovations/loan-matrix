import { NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';

/**
 * GET /api/fineract/clients/[id]/transactions
 * Gets transactions for a specific client
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

    console.log(`Fetching transactions for client ${id} with offset=${offset}, limit=${limit}`);

    // Try different possible Fineract endpoints for client transactions
    let data;
    let error;
    
    // First try the standard transactions endpoint with client filter
    try {
      const endpoint = `/loans/transactions?clientId=${id}&offset=${offset}&limit=${limit}`;
      console.log(`Trying endpoint: ${endpoint}`);
      data = await fetchFineractAPI(endpoint);
      console.log('First endpoint succeeded');
    } catch (e: any) {
      error = e;
      console.log('First endpoint failed:', e.message);
      
      // Try alternative endpoint
      try {
        const endpoint = `/clients/${id}/transactions?offset=${offset}&limit=${limit}`;
        console.log(`Trying alternative endpoint: ${endpoint}`);
        data = await fetchFineractAPI(endpoint);
        console.log('Alternative endpoint succeeded');
      } catch (e2: any) {
        error = e2;
        console.log('Alternative endpoint failed:', e2.message);
        
        // Try the general loans transactions endpoint
        try {
          const endpoint = `/loans/transactions?offset=${offset}&limit=${limit}`;
          console.log(`Trying general loans endpoint: ${endpoint}`);
          data = await fetchFineractAPI(endpoint);
          
          // Filter by client ID if we get all transactions
          if (data && Array.isArray(data.pageItems)) {
            data.pageItems = data.pageItems.filter((transaction: any) => transaction.clientId == id);
          }
          console.log('General loans endpoint succeeded');
        } catch (e3: any) {
          error = e3;
          console.log('All endpoints failed:', e3.message);
          throw e3;
        }
      }
    }
    
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching client transactions:', error);
    
    // Provide more specific error messages based on the error type
    let errorMessage = 'Unknown error';
    let statusCode = 500;
    
    if (error.message?.includes('No access token available')) {
      errorMessage = 'Authentication required - please log in';
      statusCode = 401;
    } else if (error.message?.includes('API error')) {
      errorMessage = `API Error: ${error.message}`;
      statusCode = error.status || 500;
    } else {
      errorMessage = error.message || 'Failed to fetch client transactions';
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: statusCode }
    );
  }
} 