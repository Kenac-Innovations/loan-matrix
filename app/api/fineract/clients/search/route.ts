import { NextResponse } from 'next/server';
import { fetchFineractSearch } from '@/lib/fineract-search-auth';

/**
 * POST /api/fineract/clients/search
 * Searches for clients by external ID or other criteria
 * Uses service account auth for broader search permissions
 */
export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const { text, page = 0, size = 50 } = payload;

    if (!text) {
      return NextResponse.json(
        { error: 'Search text is required' },
        { status: 400 }
      );
    }

    // Fineract v2 API expects the text to be nested inside a request object
    const searchPayload = {
      request: { text },
      page,
      size,
    };

    // Use the v2 API endpoint with service account auth
    const data = await fetchFineractSearch('/clients/search', {
      method: 'POST',
      body: JSON.stringify(searchPayload),
    }, 'v2');

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error searching clients:', error);
    
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
