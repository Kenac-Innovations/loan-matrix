import { NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';

/**
 * GET /api/fineract/clients/[id]/accounts
 * Proxies to Fineract's client accounts endpoint and returns loanAccounts
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const endpoint = `/clients/${id}/accounts`;
    const data = await fetchFineractAPI(endpoint);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching client accounts:', error);
    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}


