import { NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';

/**
 * GET /api/fineract/clients
 * Proxies to Fineract's clients endpoint
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const offset = searchParams.get('offset') || '0';
    const limit = searchParams.get('limit') || '20';
    const query = searchParams.get('query');

    let endpoint = `/clients?offset=${offset}&limit=${limit}`;
    if (query) {
      endpoint = `/clients?search=${encodeURIComponent(query)}&offset=${offset}&limit=${limit}`;
    }

    const data = await fetchFineractAPI(endpoint);
    
    // Return the data as-is to preserve the original structure
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching clients:', error);
    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/fineract/clients
 * Creates a new client in Fineract
 */
export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const data = await fetchFineractAPI('/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Error creating client:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 