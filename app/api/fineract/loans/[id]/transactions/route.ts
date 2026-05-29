import { NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';
import { getFineractServiceWithSession } from '@/lib/fineract-api';
import { isPaymentTypeCash } from '@/lib/cash-repayment-teller';
import { upsertRepaymentCashLink } from '@/lib/repayment-cash-link';
import { getTenantFromHeaders } from '@/lib/tenant-service';
import { getOrgRawCurrencyCode } from '@/lib/currency-utils';
import { fetchLoanNotificationDetails, resolveLoanNotificationTarget } from '@/lib/loan-notification-target';
import { sendLoanRepaymentSms } from '@/lib/notification-service';

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
    const tenant = await getTenantFromHeaders();
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

    // Build repayment body for Fineract WITHOUT local teller/cashier metadata
    const repaymentBody = { ...body } as Record<string, unknown>;
    delete repaymentBody.tellerId;
    delete repaymentBody.cashierId;
    delete repaymentBody.dbTellerId;
    delete repaymentBody.dbCashierId;

    const data = await fetchFineractAPI(`/loans/${id}/transactions?command=${command}`, {
      method: 'POST',
      body: JSON.stringify(repaymentBody),
    });
    const fineractTransactionId = Number(
      data?.resourceId ?? data?.transactionId ?? data?.id
    );

    let cashierAllocateResult: { success: boolean; error?: string; details?: unknown } | undefined;

    // After successful repayment: if payment is cash, call allocate to update cashier balance
    if (
      command === 'repayment' &&
      body.paymentTypeId != null &&
      body.transactionAmount != null &&
      body.transactionAmount > 0
    ) {
      const isCash = await isPaymentTypeCash(Number(body.paymentTypeId));
      const rawCurrency = await getOrgRawCurrencyCode();
      const currency = body.currencyCode ?? body.currency?.code ?? rawCurrency;
      console.log("[CashRepayment]: ")

      if (tenant && Number.isFinite(fineractTransactionId) && fineractTransactionId > 0) {
        await upsertRepaymentCashLink({
          tenantId: tenant.id,
          fineractTransactionId,
          loanId,
          transactionType: command.toUpperCase(),
          amount: Number(body.transactionAmount),
          currency,
          // These local foreign keys are enriched later by the allocate route after
          // it resolves the selected teller/cashier to real Prisma records.
          tellerId: null,
          cashierId: null,
          isCash,
        });
      }

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
                currencyCode: currency,
                txnNote: 'Loan repayment',
                dateFormat: 'yyyy-MM-dd',
                locale: 'en',
              }
            );
            cashierAllocateResult = { success: true };
            console.log(
              `[CashRepayment] Allocated ${body.transactionAmount} ${currency} for loan ${loanId} to teller ${tellerId}/cashier ${cashierId}`
            );
          } catch (err: unknown) {
            type AllocationError = {
              response?: {
                data?: {
                  defaultUserMessage?: string;
                  errors?: Array<{ defaultUserMessage?: string }>;
                };
                status?: number;
              };
              message?: string;
            };
            const allocationError = err as AllocationError;
            const fineractError = allocationError.response?.data;
            cashierAllocateResult = {
              success: false,
              error:
                fineractError?.defaultUserMessage ||
                fineractError?.errors?.[0]?.defaultUserMessage ||
                allocationError.message ||
                'Allocate failed',
              details: fineractError || { message: allocationError.message },
            };
            console.error('[CashRepayment] Allocate failed:', {
              message: allocationError.message,
              status: allocationError.response?.status,
              data: allocationError.response?.data,
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

    if (
      command === "repayment" &&
      tenant &&
      Number.isFinite(loanId) &&
      loanId > 0 &&
      body.transactionAmount != null &&
      Number(body.transactionAmount) > 0
    ) {
      void (async () => {
        const loanDetails = await fetchLoanNotificationDetails(
          loanId,
          tenant.slug
        );
        const borrower = await resolveLoanNotificationTarget({
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
          loanId,
          clientId: loanDetails?.clientId ?? null,
        });

        if (borrower) {
          const rawCurrency =
            loanDetails?.currencyCode ??
            body.currencyCode ??
            body.currency?.code ??
            (await getOrgRawCurrencyCode());
          const currency = String(rawCurrency || "ZMW").toUpperCase();

          console.log("NOW SENDING REPAYMENT SMS...")
          const smsSent = await sendLoanRepaymentSms({
            clientName: borrower.clientName,
            phone: borrower.phone,
            countryCode: borrower.countryCode ?? undefined,
            amount: Number(body.transactionAmount),
            currency,
            tenantId: tenant.slug,
          });
          if (smsSent) {
            console.log("REPAYMENT SMS SEND!...")
          } else {
            console.warn("REPAYMENT SMS NOT SENT...")
          }
        }
      })().catch((smsError) => {
        console.error("Failed to send repayment SMS:", smsError);
      });
    }

    // Include allocate result in response so it's visible in network tab when debugging
    const responseData =
      cashierAllocateResult != null
        ? { ...data, _cashierAllocate: cashierAllocateResult }
        : data;

    return NextResponse.json(responseData);
  } catch (error: unknown) {
    type LoanTransactionError = {
      status?: number;
      errorData?: {
        defaultUserMessage?: string;
        errors?: Array<{ defaultUserMessage?: string }>;
      };
      message?: string;
    };
    const loanTransactionError = error as LoanTransactionError;
    console.error('Error submitting loan transaction:', loanTransactionError);
    
    // Check if it's an API error with status and errorData
    if (loanTransactionError.status && loanTransactionError.errorData) {
      return NextResponse.json(
        { 
          error: loanTransactionError.message,
          status: loanTransactionError.status,
          details: loanTransactionError.errorData 
        },
        { status: loanTransactionError.status }
      );
    }
    
    return NextResponse.json(
      { error: loanTransactionError.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
