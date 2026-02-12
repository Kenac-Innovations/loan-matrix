import { NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';
import { getFineractServiceWithSession } from '@/lib/fineract-api';
import { isPaymentTypeCash } from '@/lib/cash-repayment-teller';

/** Format YYYY-MM-DD to "dd MMMM yyyy" for Fineract allocate */
function formatDateForFineractAllocate(isoDate: string): string {
  const d = new Date(isoDate);
  const day = d.getDate();
  const month = d.toLocaleString('en', { month: 'long' });
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * POST /api/fineract/loans/[id]/transactions
 * Proxies to Fineract's loan transactions endpoint.
 * For repayment command: reads tellerId and cashierId from body, strips them before
 * forwarding to Fineract. After successful repayment, if payment is cash, calls
 * Fineract allocate with tellerId/cashierId in the path.
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

    // Ask for and store tellerId and cashierId from the request body
    const tellerId = body.tellerId != null ? Number(body.tellerId) : null;
    const cashierId = body.cashierId != null ? Number(body.cashierId) : null;

    // Build repayment body for Fineract WITHOUT tellerId and cashierId
    const { tellerId: _t, cashierId: _c, ...repaymentBody } = body;

    const data = await fetchFineractAPI(`/loans/${id}/transactions?command=${command}`, {
      method: 'POST',
      body: JSON.stringify(repaymentBody),
    });

    // After successful repayment: if payment is cash and we have teller/cashier, call allocate
    if (
      command === 'repayment' &&
      body.paymentTypeId != null &&
      body.transactionAmount != null &&
      body.transactionAmount > 0 &&
      tellerId != null &&
      !isNaN(tellerId) &&
      cashierId != null &&
      !isNaN(cashierId)
    ) {
      const isCash = await isPaymentTypeCash(Number(body.paymentTypeId));
      if (isCash) {
        try {
          const fineractService = await getFineractServiceWithSession();
          const transactionDate =
            typeof body.transactionDate === 'string'
              ? body.transactionDate
              : new Date().toISOString().split('T')[0];
          const currency =
            body.currencyCode ?? body.currency?.code ?? 'ZMW';
          const normalizedCurrency =
            String(currency).toUpperCase() === 'ZMK' ? 'ZMW' : currency;

          await fineractService.allocateCashToCashier(
            tellerId,
            cashierId,
            {
              txnDate: formatDateForFineractAllocate(transactionDate),
              txnAmount: String(body.transactionAmount),
              currencyCode: normalizedCurrency,
              txnNote: `Loan repayment #${loanId}`,
              dateFormat: 'dd MMMM yyyy',
              locale: 'en',
            }
          );
          console.log(
            `[CashRepayment] Allocated ${body.transactionAmount} ${normalizedCurrency} for loan ${loanId} to teller ${tellerId}/cashier ${cashierId}`
          );
        } catch (err: any) {
          console.error('[CashRepayment] Allocate failed:', err);
          // Do not fail repayment; log only
        }
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