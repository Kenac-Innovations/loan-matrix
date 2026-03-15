import { NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';

/**
 * GET /api/fineract/account-tags
 * Proxies to Fineract's account tags endpoint
 */
export async function GET() {
  try {
    const data = await fetchFineractAPI('/accountTags');
    return NextResponse.json({ accountTags: data });
  } catch (e: any) {
    console.error('Error fetching account tags:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}