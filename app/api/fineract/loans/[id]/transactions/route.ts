import { NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';
import { getFineractServiceWithSession } from '@/lib/fineract-api';
import { isPaymentTypeCash } from '@/lib/cash-repayment-teller';

/** Ensure date is yyyy-MM-dd for Fineract allocate */
function formatDateForAllocate(isoDate: string): string {
  const d = new Date(isoDate);
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
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

    // Parse tellerId and cashierId from request body (support "fineract-123" format)
    let tellerId: number | null = null;
    if (body.tellerId != null) {
      if (typeof body.tellerId === 'string' && body.tellerId.startsWith('fineract-')) {
        tellerId = parseInt(body.tellerId.replace('fineract-', ''), 10);
      } else {
        tellerId = Number(body.tellerId);
      }
      if (isNaN(tellerId)) tellerId = null;
    }
    let cashierId: number | null = null;
    if (body.cashierId != null) {
      cashierId = Number(body.cashierId);
      if (isNaN(cashierId)) cashierId = null;
    }

    // Build repayment body for Fineract WITHOUT tellerId and cashierId
    const { tellerId: _t, cashierId: _c, ...repaymentBody } = body;

    const data = await fetchFineractAPI(`/loans/${id}/transactions?command=${command}`, {
      method: 'POST',
      body: JSON.stringify(repaymentBody),
    });

    let cashierAllocateResult: { success: boolean; error?: string; details?: unknown } | undefined;

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
          // Request includes tellerId/cashierId - call allocate here
          try {
            const fineractService = await getFineractServiceWithSession();
            await fineractService.allocateCashToCashier(
              tellerId,
              cashierId,
              {
                txnDate: formatDateForAllocate(transactionDate),
                txnAmount: String(body.transactionAmount),
                currencyCode: normalizedCurrency,
                txnNote: 'Loan repayment',
                dateFormat: 'yyyy-MM-dd',
                locale: 'en',
              }
            );
            cashierAllocateResult = { success: true };
            console.log(
              `[CashRepayment] Allocated ${body.transactionAmount} ${normalizedCurrency} for loan ${loanId} to teller ${tellerId}/cashier ${cashierId}`
            );
          } catch (err: any) {
            const fineractError = err?.response?.data;
            cashierAllocateResult = {
              success: false,
              error:
                fineractError?.defaultUserMessage ||
                fineractError?.errors?.[0]?.defaultUserMessage ||
                err?.message ||
                'Allocate failed',
              details: fineractError || { message: err?.message },
            };
            console.error('[CashRepayment] Allocate failed:', {
              message: err?.message,
              status: err?.response?.status,
              data: err?.response?.data,
            });
          }
        } else {
          // No tellerId/cashierId in request - frontend will call allocate after 200
          // (Repayment modal uses active till from allocate modal)
          cashierAllocateResult = {
            success: true,
            error: 'Skipped - allocate handled by frontend with active till',
          };
        }
      } else {
        cashierAllocateResult = { success: false, error: 'Skipped - payment type is not cash' };
      }
    }

    // Include allocate result in response so it's visible in network tab when debugging
    const responseData =
      cashierAllocateResult != null
        ? { ...data, _cashierAllocate: cashierAllocateResult }
        : data;

    return NextResponse.json(responseData);
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