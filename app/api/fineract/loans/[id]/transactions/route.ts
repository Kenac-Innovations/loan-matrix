import { NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';
import { isPaymentTypeCash } from '@/lib/cash-repayment-teller';
import { upsertRepaymentCashLink } from '@/lib/repayment-cash-link';
import { getTenantFromHeaders } from '@/lib/tenant-service';
import { getOrgRawCurrencyCode } from '@/lib/currency-utils';
import { fetchLoanNotificationDetails, resolveLoanNotificationTarget } from '@/lib/loan-notification-target';
import { sendLoanRepaymentSms } from '@/lib/notification-service';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { recordInventoryRepayment } from '@/lib/inventory/inventory-repayment-service';
import { type InventoryDb } from '@/lib/inventory/inventory-ledger-service';

function repaymentDate(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return new Date();

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date();

  // Fineract receives a calendar date such as "19 August 2026". Persist the
  // same calendar day in UTC so finance date filters do not lose it when the
  // application server has a positive time-zone offset.
  return new Date(
    Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12)
  );
}

/**
 * POST /api/fineract/loans/[id]/transactions
 * Proxies to Fineract's loan transactions endpoint.
 * For cash repayments: resolves the selected teller/cashier back to the local
 * operational records before the repayment is posted, then stores that linkage
 * on the RepaymentCashLink row after Fineract succeeds.
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
    const dbTellerId =
      typeof body.dbTellerId === 'string' && body.dbTellerId.trim().length > 0
        ? body.dbTellerId.trim()
        : null;
    const dbCashierId =
      typeof body.dbCashierId === 'string' && body.dbCashierId.trim().length > 0
        ? body.dbCashierId.trim()
        : null;

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
      if (
        typeof body.cashierId === 'string' &&
        body.cashierId.startsWith('fineract-')
      ) {
        cashierId = parseInt(body.cashierId.replace('fineract-', ''), 10);
      } else {
        cashierId = Number(body.cashierId);
      }
      if (isNaN(cashierId)) cashierId = null;
    }

    let linkedTeller:
      | {
          id: string;
          name: string;
          fineractTellerId: number | null;
        }
      | null = null;
    let linkedCashier:
      | {
          id: string;
          tellerId: string;
          staffName: string;
          fineractCashierId: number | null;
        }
      | null = null;

    // Build repayment body for Fineract WITHOUT local teller/cashier metadata
    const repaymentBody = { ...body } as Record<string, unknown>;
    delete repaymentBody.tellerId;
    delete repaymentBody.cashierId;
    delete repaymentBody.dbTellerId;
    delete repaymentBody.dbCashierId;

    if (
      command === 'repayment' &&
      body.paymentTypeId != null &&
      body.transactionAmount != null &&
      Number(body.transactionAmount) > 0
    ) {
      const isCash = await isPaymentTypeCash(Number(body.paymentTypeId));

      if (isCash) {
        if (!tenant) {
          return NextResponse.json(
            { error: 'Tenant context is required for cash repayments' },
            { status: 400 }
          );
        }

        if (!dbTellerId && (tellerId == null || isNaN(tellerId))) {
          return NextResponse.json(
            {
              error:
                'Cash repayments require a selected teller with an active session.',
            },
            { status: 400 }
          );
        }

        if (!dbCashierId && (cashierId == null || isNaN(cashierId))) {
          return NextResponse.json(
            {
              error:
                'Cash repayments require a selected cashier with an active session.',
            },
            { status: 400 }
          );
        }

        if (dbTellerId) {
          linkedTeller = await prisma.teller.findFirst({
            where: {
              id: dbTellerId,
              tenantId: tenant.id,
              isActive: true,
            },
            select: {
              id: true,
              name: true,
              fineractTellerId: true,
            },
          });
        } else if (tellerId != null && !isNaN(tellerId)) {
          linkedTeller = await prisma.teller.findFirst({
            where: {
              tenantId: tenant.id,
              fineractTellerId: tellerId,
              isActive: true,
            },
            select: {
              id: true,
              name: true,
              fineractTellerId: true,
            },
          });
        }

        if (!linkedTeller?.fineractTellerId) {
          return NextResponse.json(
            {
              error:
                'The selected teller is no longer linked to an active Fineract teller.',
            },
            { status: 400 }
          );
        }

        if (dbCashierId) {
          linkedCashier = await prisma.cashier.findFirst({
            where: {
              id: dbCashierId,
              tenantId: tenant.id,
              tellerId: linkedTeller.id,
              isActive: true,
            },
            select: {
              id: true,
              tellerId: true,
              staffName: true,
              fineractCashierId: true,
            },
          });
        } else if (cashierId != null && !isNaN(cashierId)) {
          linkedCashier = await prisma.cashier.findFirst({
            where: {
              tenantId: tenant.id,
              tellerId: linkedTeller.id,
              fineractCashierId: cashierId,
              isActive: true,
            },
            select: {
              id: true,
              tellerId: true,
              staffName: true,
              fineractCashierId: true,
            },
          });
        }

        if (!linkedCashier?.fineractCashierId) {
          return NextResponse.json(
            {
              error:
                'The selected cashier is no longer linked to an active Fineract cashier.',
            },
            { status: 400 }
          );
        }

        const activeSession = await prisma.cashierSession.findFirst({
          where: {
            tenantId: tenant.id,
            tellerId: linkedTeller.id,
            cashierId: linkedCashier.id,
            sessionStatus: 'ACTIVE',
          },
          select: { id: true },
        });

        if (!activeSession) {
          return NextResponse.json(
            {
              error:
                'The selected cashier does not have an active session for this teller.',
            },
            { status: 400 }
          );
        }

        tellerId = linkedTeller.fineractTellerId;
        cashierId = linkedCashier.fineractCashierId;
      }
    }

    const data = await fetchFineractAPI(`/loans/${id}/transactions?command=${command}`, {
      method: 'POST',
      body: JSON.stringify(repaymentBody),
    });
    const fineractTransactionId = Number(
      data?.resourceId ?? data?.transactionId ?? data?.id
    );

    let cashierAllocateResult: { success: boolean; error?: string; details?: unknown } | undefined;
    let inventoryRepaymentWarning: string | undefined;

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
          tellerId: isCash ? linkedTeller?.id ?? null : null,
          cashierId: isCash ? linkedCashier?.id ?? null : null,
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
        // Manual Fineract allocate is disabled for repayments because Fineract
        // already surfaces cash loan repayments in cashier summary/history.
        // Calling allocate here creates duplicate cashier rows.
        cashierAllocateResult = {
          success: true,
          error: 'Skipped - manual Fineract allocate disabled for repayments',
        };
      } else {
        cashierAllocateResult = { success: false, error: 'Skipped - payment type is not cash' };
      }
    }

    // ARDA issues stock in place of cash. Once Fineract accepts a repayment,
    // mirror that transaction in the local stock-recovery ledger. A Fineract
    // transaction ID makes the operation safe if the browser retries it.
    if (
      command === 'repayment' &&
      tenant &&
      Number.isFinite(fineractTransactionId) &&
      fineractTransactionId > 0 &&
      Number.isFinite(loanId) &&
      loanId > 0 &&
      body.transactionAmount != null &&
      Number(body.transactionAmount) > 0
    ) {
      const stockIssue = await prisma.stockLoanIssue.findFirst({
        where: {
          tenantId: tenant.id,
          fineractLoanId: loanId,
          status: { in: ['ISSUED', 'REPAID'] },
        },
        select: {
          id: true,
          currencyCode: true,
        },
      });

      if (stockIssue) {
        try {
          const session = await getSession();
          await recordInventoryRepayment(prisma as unknown as InventoryDb, {
            tenantId: tenant.id,
            stockLoanIssueId: stockIssue.id,
            amount: String(body.transactionAmount),
            currencyCode: stockIssue.currencyCode,
            paymentDate: repaymentDate(body.transactionDate),
            reference: `Fineract repayment ${fineractTransactionId}`,
            notes: 'Recorded automatically from the Fineract loan repayment.',
            actorUserId: String(
              (session?.user as Record<string, unknown> | undefined)?.userId ??
                session?.user?.id ??
                'fineract'
            ),
            actorUserName: String(session?.user?.name ?? 'Fineract repayment'),
            idempotencyKey: `fineract-stock-repayment:${tenant.id}:${loanId}:${fineractTransactionId}`,
          });
        } catch (inventoryError) {
          // Fineract has already accepted the payment. Do not report the
          // repayment as failed, otherwise retrying could duplicate it there.
          inventoryRepaymentWarning =
            inventoryError instanceof Error
              ? inventoryError.message
              : 'The ARDA inventory repayment could not be recorded.';
          console.error('Failed to record ARDA inventory repayment:', inventoryError);
        }
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
    const responseData = {
      ...data,
      ...(cashierAllocateResult != null
        ? { _cashierAllocate: cashierAllocateResult }
        : {}),
      ...(inventoryRepaymentWarning
        ? { _inventoryRepaymentWarning: inventoryRepaymentWarning }
        : {}),
    };

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
