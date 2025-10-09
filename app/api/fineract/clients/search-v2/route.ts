import { NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';
import { ClientSearchRequest, ClientSearchResponse } from '@/types/client-search';

/**
 * POST /api/fineract/clients/search-v2
 * Searches for clients using the v2 API with proper payload structure
 */
export async function POST(request: Request) {
  try {
    const payload: ClientSearchRequest = await request.json();
    const { request: searchRequest, page = 0, size = 50 } = payload;

    if (!searchRequest?.text) {
      return NextResponse.json(
        { error: 'Search text is required' },
        { status: 400 }
      );
    }

    // Use the v2 API endpoint with proper payload structure
    const searchPayload = {
      request: {
        text: searchRequest.text
      },
      page,
      size
    };

    // Make the request to the v2 API endpoint using the unified function
    const data: ClientSearchResponse = await fetchFineractAPI('/clients/search', {
      method: 'POST',
      body: JSON.stringify(searchPayload),
    }, 'v2');

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error searching clients with v2 API:', error);
    
    // Handle specific error cases
    if (error.status === 404) {
      return NextResponse.json(
        { error: 'No clients found with the provided search criteria' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Unknown error occurred during client search' },
      { status: 500 }
    );
  }
}
