import { NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';

/**
 * GET /api/fineract/account-types
 * Proxies to Fineract's account classification types endpoint
 */
export async function GET() {
  try {
    const data = await fetchFineractAPI('/glAccountClassificationType');
    return NextResponse.json({ accountTypes: data });
  } catch (e: any) {
    console.error('Error fetching account types:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
