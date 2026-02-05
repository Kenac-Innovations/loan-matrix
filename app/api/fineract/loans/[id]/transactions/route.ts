import { NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';
import { getTenantFromHeaders } from '@/lib/tenant-service';
import { recordCashRepaymentToTeller } from '@/lib/cash-repayment-teller';

/**
 * POST /api/fineract/loans/[id]/transactions
 * Proxies to Fineract's loan transactions endpoint.
 * For repayment command: if payment is cash, records cash-in to teller/cashier balance.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const loanId = parseInt(id, 10);
    const { searchParams } = new URL(request.url);
    const command = searchParams.get('command');

    if (!command) {
      return NextResponse.json(
        { error: 'Command parameter is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const data = await fetchFineractAPI(`/loans/${id}/transactions?command=${command}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    // After successful repayment: if cash payment, record to teller/cashier balance
    if (
      command === 'repayment' &&
      body.paymentTypeId != null &&
      body.transactionAmount != null &&
      body.transactionAmount > 0 &&
      !isNaN(loanId)
    ) {
      const tenant = await getTenantFromHeaders();
      if (tenant) {
        const transactionDate =
          typeof body.transactionDate === 'string'
            ? body.transactionDate
            : new Date().toISOString().split('T')[0];
        await recordCashRepaymentToTeller({
          loanId,
          amount: Number(body.transactionAmount),
          currency: body.currencyCode ?? body.currency?.code,
          transactionDate,
          tenantId: tenant.id,
          paymentTypeId: Number(body.paymentTypeId),
          cashierId: body.cashierId != null ? Number(body.cashierId) : undefined,
          tellerId: body.tellerId != null ? Number(body.tellerId) : undefined,
        }).catch((err) => {
          // Do not fail repayment; log only
          console.error('[CashRepayment] Post-repayment teller update failed:', err);
        });
      }
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error submitting loan transaction:', error);
    
    // Check if it's an API error with status and errorData
    if (error.status && error.errorData) {
      return NextResponse.json(
        { 
          error: error.message,
          status: error.status,
          details: error.errorData 
        },
        { status: error.status }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}