import { NextResponse } from 'next/server';
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
    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}