import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchFineractAPI } from '@/lib/api';
import { format } from 'date-fns';
import { sendLoanStatusSms } from '@/lib/notification-service';

/**
 * POST /api/ussd-leads/[id]/submit
 * Creates a Fineract loan using data from USSD application and returns the core response.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const applicationId = Number(id);
    if (Number.isNaN(applicationId)) {
      return NextResponse.json({ error: 'Invalid application id' }, { status: 400 });
    }

    // Optional payload from caller (leadId override for externalId)
    let incoming: Record<string, unknown> = {};
    try {
      const parsed = await request.json();
      if (parsed && typeof parsed === "object") {
        incoming = parsed as Record<string, unknown>;
      }
    } catch {
      // Ignore malformed optional payloads.
    }

    // Load application by loanApplicationUssdId
    const app = await prisma.ussdLoanApplication.findFirst({
      where: { loanApplicationUssdId: applicationId },
    });

    if (!app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    // Determine submitted and expected disbursement dates
    let baseDate = app.queuedAt ?? app.createdAt ?? new Date();
    const coerceValidDate = (d: Date): Date => {
      if (!(d instanceof Date) || isNaN(d.getTime())) return new Date();
      // Avoid epoch/placeholder values
      if (d.getFullYear() < 2000) return new Date();
      return d;
    };
    baseDate = coerceValidDate(new Date(baseDate));

    // Align with client's activation date to satisfy domain rule
    if (app.loanMatrixClientId) {
      try {
        const client = await fetchFineractAPI(
          `/clients/${app.loanMatrixClientId}`
        );
        const activationArr = client?.timeline?.activationDate as
          | number[]
          | undefined;
        if (Array.isArray(activationArr) && activationArr.length >= 3) {
          const [y, m, d] = activationArr;
          let activationDate = new Date(
            y as number,
            (m as number) - 1,
            d as number
          );
          activationDate = coerceValidDate(activationDate);
          if (baseDate < activationDate) baseDate = activationDate;
        }
      } catch {
        // If we can't load client, continue with current baseDate
      }
    }

    // Finalize dates with validation
    let dateStr = format(baseDate, 'yyyy-MM-dd');
    if (!dateStr || dateStr.includes('Invalid')) {
      baseDate = new Date();
      dateStr = format(baseDate, 'yyyy-MM-dd');
    }

    // Debug (server log only)
    console.log('[USSD Submit] Dates used', {
      appQueuedAt: app.queuedAt,
      appCreatedAt: app.createdAt,
      baseDateISO: baseDate.toISOString(),
      dateStr,
    });

    const clampedRepayments = Math.max(3, Math.min(24, app.loanTermMonths ?? 6));

    const repaymentEvery = 1; // months per installment
    const loanTermFrequency = clampedRepayments * repaymentEvery; // align term with repayments

    const payload: Record<string, unknown> = {
      clientId: app.loanMatrixClientId,
      productId: app.loanMatrixLoanProductId,
      principal: app.principalAmount,
      loanTermFrequency,
      loanTermFrequencyType: 2, // Months
      numberOfRepayments: clampedRepayments,
      repaymentEvery,
      repaymentFrequencyType: 2, // Months
      interestRatePerPeriod: 7, // default; adjust if you have product rates
      interestRateFrequencyType: 2, // Per month
      interestType: 0, // Flat
      amortizationType: 1, // Equal installments
      interestCalculationPeriodType: 1, // Same as repayment period
      transactionProcessingStrategyCode: 'creocore-strategy',
      submittedOnDate: dateStr,
      expectedDisbursementDate: dateStr,
      locale: 'en',
      dateFormat: 'yyyy-MM-dd',
      // Prefer provided leadId, else use the USSD application's primary key `id`,
      // then fall back to referenceNumber or messageId
      externalId:
        (app.id ? String(app.id) : undefined) ||
        (typeof incoming.leadId === "string" ? incoming.leadId : undefined) ||
        app.referenceNumber ||
        app.messageId ||
        undefined,
      allowPartialPeriodInterestCalcualtion: false,
      isEqualAmortization: false,
      charges: [],
      collateral: [],
      loanType: 'individual',
    };

    // POST to Fineract /loans
    const result = await fetchFineractAPI('/loans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (result && result.resourceId) {
      const loanId = result.resourceId;
      
      // Update the loan with the external ID set to the loan ID
      try {
        await fetchFineractAPI(`/loans/${loanId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            externalId: String(loanId),
            locale: 'en',
            dateFormat: 'yyyy-MM-dd',
          }),
        });
        
        console.log(`Updated loan ${loanId} with external ID set to loan ID`);
      } catch (updateError) {
        console.error('Failed to update loan external ID:', updateError);
        // Don't fail the entire operation if external ID update fails
      }

      // Send SMS: loan submitted, pending approval (best-effort)
      // if (app.userPhoneNumber) {
      //   void (async () => {
      //     const tenant = await prisma.tenant.findUnique({
      //       where: { id: app.tenantId },
      //       select: { slug: true },
      //     });
      //     await sendLoanStatusSms({
      //       type: "pending_approval",
      //       clientName: app.userFullName || "Customer",
      //       phone: app.userPhoneNumber,
      //       amount: Number(app.principalAmount) || 0,
      //       tenantId: tenant?.slug,
      //     });
      //   })().catch((smsError) => {
      //     console.error("Failed to send pending-approval SMS:", smsError);
      //   });
      // }
    }

    return NextResponse.json({ success: true, coreResponse: result });
  } catch (error: unknown) {
    type LoanCreationError = {
      status?: number;
      errorData?: {
        defaultUserMessage?: string;
        errors?: Array<{ defaultUserMessage?: string }>;
      };
      message?: string;
    };
    const loanCreationError = error as LoanCreationError;
    console.error('Error creating loan from USSD application:', loanCreationError);
    if (loanCreationError.status && loanCreationError.errorData) {
      return NextResponse.json(
        { error: loanCreationError.message, status: loanCreationError.status, errorData: loanCreationError.errorData },
        { status: loanCreationError.status }
      );
    }
    return NextResponse.json({ error: loanCreationError.message || 'Unknown error' }, { status: 500 });
  }
}
