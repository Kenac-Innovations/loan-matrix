import { NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';

/**
 * POST /api/fineract/clients/search
 * Searches for clients by external ID or other criteria
 */
export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const { text, page = 0, size = 50 } = payload;

    // Fineract expects the text to be nested inside a request object
    const searchPayload = {
      page,
      request: { text },
      size,
    };

    // Use the correct endpoint: /clients with search parameter
    const data = await fetchFineractAPI(`/clients?search=${encodeURIComponent(text)}`);

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error searching clients:', error);
    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
