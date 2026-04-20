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

    if (!data?.loanAccounts || !Array.isArray(data.loanAccounts) || data.loanAccounts.length === 0) {
      return NextResponse.json(data);
    }

    const detailedLoanAccounts = await Promise.all(
      data.loanAccounts.map(async (loanAccount: { id?: number; summary?: Record<string, unknown> }) => {
        if (!loanAccount?.id) return loanAccount;

        try {
          const loanDetails = await fetchFineractAPI(`/loans/${loanAccount.id}`);
          return {
            ...loanAccount,
            ...loanDetails,
            summary: {
              ...(loanAccount.summary || {}),
              ...(loanDetails?.summary || {}),
            },
          };
        } catch (detailError) {
          console.warn(`Failed to enrich loan account ${loanAccount.id}:`, detailError);
          return loanAccount;
        }
      })
    );

    return NextResponse.json({
      ...data,
      loanAccounts: detailedLoanAccounts,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching client accounts:', error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
