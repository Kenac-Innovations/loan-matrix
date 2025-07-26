import { NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';

/**
 * GET /api/fineract/account-usages
 * Proxies to Fineract's account usage endpoint
 */
export async function GET() {
  try {
    const data = await fetchFineractAPI('/glAccountUsage');
    return NextResponse.json({ accountUsages: data });
  } catch (e: any) {
    console.error('Error fetching account usages:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}