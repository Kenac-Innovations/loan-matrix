import { NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';
import { getTenantFromHeaders } from '@/lib/tenant-service';
import { isPaymentTypeCash, recordCashRepaymentToTeller } from '@/lib/cash-repayment-teller';

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

    // After successful repayment: if payment is cash, call allocate to update cashier balance
    if (
      command === 'repayment' &&
      body.paymentTypeId != null &&
      body.transactionAmount != null &&
      body.transactionAmount > 0
    ) {
      const isCash = await isPaymentTypeCash(Number(body.paymentTypeId));
      console.log('[CashRepayment] Repayment succeeded', {
        loanId,
        paymentTypeId: body.paymentTypeId,
        isCash,
        tellerId,
        cashierId,
        hasTellerCashier: tellerId != null && cashierId != null,
      });

      if (isCash) {
        const transactionDate =
          typeof body.transactionDate === 'string'
            ? body.transactionDate
            : new Date().toISOString().split('T')[0];
        const currency =
          body.currencyCode ?? body.currency?.code ?? 'ZMW';
        const normalizedCurrency =
          String(currency).toUpperCase() === 'ZMK' ? 'ZMW' : currency;

        if (
          tellerId != null &&
          !isNaN(tellerId) &&
          cashierId != null &&
          !isNaN(cashierId)
        ) {
          // Use tellerId/cashierId from request body - call allocate via fetchFineractAPI (same as repayment)
          try {
            const allocateBody = {
              txnDate: formatDateForFineractAllocate(transactionDate),
              txnAmount: String(body.transactionAmount),
              currencyCode: normalizedCurrency,
              txnNote: `Loan repayment #${loanId}`,
              dateFormat: 'dd MMMM yyyy',
              locale: 'en',
            };
            await fetchFineractAPI(
              `/tellers/${tellerId}/cashiers/${cashierId}/allocate`,
              {
                method: 'POST',
                body: JSON.stringify(allocateBody),
              }
            );
            console.log(
              `[CashRepayment] Allocated ${body.transactionAmount} ${normalizedCurrency} for loan ${loanId} to teller ${tellerId}/cashier ${cashierId}`
            );
          } catch (err: any) {
            console.error('[CashRepayment] Allocate failed:', {
              message: err?.message,
              status: err?.status,
              errorData: err?.errorData,
            });
          }
        } else {
          // Fallback: resolve teller/cashier from loan office (e.g. Prepay Loan flow)
          const tenant = await getTenantFromHeaders();
          if (tenant) {
            const result = await recordCashRepaymentToTeller({
              loanId,
              amount: Number(body.transactionAmount),
              currency: normalizedCurrency,
              transactionDate,
              tenantId: tenant.id,
              paymentTypeId: Number(body.paymentTypeId),
            }).catch((err) => {
              console.error('[CashRepayment] Fallback allocate failed:', err);
              return { success: false, error: err?.message };
            });
            if (!result.success) {
              console.warn('[CashRepayment] Could not update cashier:', result.error);
            }
          }
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