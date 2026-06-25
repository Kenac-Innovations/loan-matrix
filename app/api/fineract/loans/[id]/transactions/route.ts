import { NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';
import { isPaymentTypeCash } from '@/lib/cash-repayment-teller';
import { upsertRepaymentCashLink } from '@/lib/repayment-cash-link';
import { getTenantFromHeaders } from '@/lib/tenant-service';
import { getOrgRawCurrencyCode } from '@/lib/currency-utils';
import { fetchLoanNotificationDetails, resolveLoanNotificationTarget } from '@/lib/loan-notification-target';
import { sendLoanRepaymentSms } from '@/lib/notification-service';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/fineract/loans/[id]/transactions
 * Proxies to Fineract's loan transactions endpoint.
 * For cash repayments, Fineract records the cashier receipt itself. Loan Matrix
 * records the local teller/cashier association only; it must not post a second
 * allocation because that duplicates the cash-in entry.
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

    // Link the single Fineract receipt to the selected local till for display and audit.
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
        const dbTellerId =
          typeof body.dbTellerId === 'string' ? body.dbTellerId : null;
        const dbCashierId =
          typeof body.dbCashierId === 'string' ? body.dbCashierId : null;
        const [teller, cashier] = await Promise.all([
          dbTellerId
            ? prisma.teller.findFirst({
                where: { id: dbTellerId, tenantId: tenant.id },
                select: { id: true },
              })
            : Promise.resolve(null),
          dbCashierId
            ? prisma.cashier.findFirst({
                where: { id: dbCashierId, tenantId: tenant.id },
                select: { id: true, tellerId: true },
              })
            : Promise.resolve(null),
        ]);

        const hasMatchingTill =
          teller != null && cashier != null && cashier.tellerId === teller.id;

        await upsertRepaymentCashLink({
          tenantId: tenant.id,
          fineractTransactionId,
          loanId,
          transactionType: command.toUpperCase(),
          amount: Number(body.transactionAmount),
          currency,
          tellerId: hasMatchingTill ? teller.id : null,
          cashierId: hasMatchingTill ? cashier.id : null,
          isCash,
        });
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

    return NextResponse.json(data);
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
