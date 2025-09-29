import { NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';

/**
 * GET /api/fineract/loans
 * Returns paginated loans from Fineract
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const offset = searchParams.get('offset') || '0';
    const limit = searchParams.get('limit') || '50';
    const endpoint = `/loans?offset=${offset}&limit=${limit}`;
    const data = await fetchFineractAPI(endpoint);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching loans:', error);
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 });
  }
}


