import { NextResponse } from 'next/server';
import { buildFineractErrorResponse } from '@/lib/fineract-route-error';
import { fetchFineractAPI } from '@/lib/api';

/**
 * GET /api/accounting/chart-of-accounts
 * Proxies to Fineract's GL Accounts endpoint
 */
export async function GET() {
  try {
    const data = await fetchFineractAPI('/glaccounts');
    // Wrap or transform as needed
    return NextResponse.json({ chartAccounts: data });
  } catch (error: any) {
    console.error('Error fetching Chart of Accounts:', error);
    return buildFineractErrorResponse(error);
  }
}