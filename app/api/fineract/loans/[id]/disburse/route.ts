import { NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import {
  applyLeadVisibilityScope,
  getDisbursementBlockReason,
  getLeadViewerAccessContext,
} from '@/lib/lead-policy';
import {
  buildPaymentServiceCallbackUrl,
  getRequiredPaymentServiceCallbackUrl,
} from '@/lib/payment-service-callback-url';
import { applyTopupDisbursementCharges } from '@/lib/topup-disbursement-charge-service';
import { extractTenantSlugFromRequest, getTenantBySlug } from '@/lib/tenant-service';
import { resolveYangoUssdDisbursementDetailsForLead } from '@/lib/yango-ussd-disbursement';
import { checkCashDisbursementSessionGate } from '@/lib/cashier-session-disbursement-gate';
import { getCashierSessionTenantSettings } from '@/lib/cashier-session-settings';
import { getPaymentTypeInfo } from '@/lib/cash-repayment-teller';
import { getArdaStockDetails } from '@/lib/inventory/arda-stock-workflow-service';
import { runArdaStockDisbursementGuard } from '@/lib/arda-stock-disbursement-guard';
import type { Prisma } from '@/app/generated/prisma';

type LinkedLead = {
  id: string;
  tenantId: string;
  stateMetadata: Prisma.JsonValue;
  externalId: string | null;
  loanProductId: number | null;
  loanProductName: string | null;
  mobileNo: string | null;
  accountNumber: string | null;
  preferredPaymentMethod: string | null;
  assignedToUserId: number | null;
  assignedToUserName: string | null;
  designatedDisburserUserId: number | null;
  designatedDisburserUserName: string | null;
};

function coercePositiveNumber(value: unknown): number | undefined {
  const numericValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numericValue) && numericValue > 0
    ? numericValue
    : undefined;
}

/**
 * POST /api/fineract/loans/[id]/disburse
 * Submits loan disbursement using Fineract command API
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const payload = await request.json();
    const session = await getSession();

    if (!session?.user?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantSlug = extractTenantSlugFromRequest(request);
    const tenant = await getTenantBySlug(tenantSlug);
    let linkedLead: LinkedLead | null = null;

    if (tenant) {
      const leadAccess = await getLeadViewerAccessContext(
        tenant.id,
        session.user.userId
      );
      const leadRecord = await prisma.lead.findFirst({
        where: {
          tenantId: tenant.id,
          fineractLoanId: Number(id),
        },
        select: {
          id: true,
          tenantId: true,
          stateMetadata: true,
          externalId: true,
          loanProductId: true,
          loanProductName: true,
          mobileNo: true,
          accountNumber: true,
          preferredPaymentMethod: true,
          assignedToUserId: true,
          assignedToUserName: true,
          designatedDisburserUserId: true,
          designatedDisburserUserName: true,
        },
      });

      linkedLead = leadRecord
        ? await prisma.lead.findFirst({
            where: applyLeadVisibilityScope(
              {
                id: leadRecord.id,
                tenantId: tenant.id,
              },
              leadAccess.visibleOfficeIds
            ),
            select: {
              id: true,
              tenantId: true,
              stateMetadata: true,
              externalId: true,
              loanProductId: true,
              loanProductName: true,
              mobileNo: true,
              accountNumber: true,
              preferredPaymentMethod: true,
              assignedToUserId: true,
              assignedToUserName: true,
              designatedDisburserUserId: true,
              designatedDisburserUserName: true,
            },
          })
        : null;

      if (leadRecord && !linkedLead) {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
      }

      if (leadAccess.flags.onlyOriginatorCanDisburse && linkedLead) {
        const blockReason = getDisbursementBlockReason({
          onlyOriginatorCanDisburse:
            leadAccess.flags.onlyOriginatorCanDisburse,
          designatedDisburserUserId: linkedLead.designatedDisburserUserId,
          designatedDisburserUserName: linkedLead.designatedDisburserUserName,
          assignedToUserId: linkedLead.assignedToUserId,
          assignedToUserName: linkedLead.assignedToUserName,
          currentFineractUserId: session.user.userId,
        });

        if (blockReason) {
          return NextResponse.json(
            {
              error: blockReason,
              leadId: linkedLead.id,
            },
            { status: 403 }
          );
        }
      }
    }

    const augmentedPayload: Record<string, unknown> = {
      ...payload,
    };

    const numericPaymentTypeId =
      typeof payload?.paymentTypeId === "number"
        ? payload.paymentTypeId
        : Number.isFinite(Number(payload?.paymentTypeId))
          ? Number(payload.paymentTypeId)
          : null;
    const yangoUssdDetails = linkedLead
      ? await resolveYangoUssdDisbursementDetailsForLead(
          linkedLead,
          numericPaymentTypeId
        )
      : null;

    if (yangoUssdDetails) {
      const callbackUrl = buildPaymentServiceCallbackUrl(
        getRequiredPaymentServiceCallbackUrl(),
        tenant?.ussdServiceTenantId
      );
      augmentedPayload.externalId = yangoUssdDetails.externalId;
      augmentedPayload.accountNumber = yangoUssdDetails.accountNumber;
      if (yangoUssdDetails.paymentTypeId) {
        augmentedPayload.paymentTypeId = yangoUssdDetails.paymentTypeId;
      }
      if (!coercePositiveNumber(augmentedPayload.transactionAmount)) {
        const fineractLoan = await fetchFineractAPI(`/loans/${id}`, {
          authMode: 'service',
        });
        augmentedPayload.transactionAmount =
          coercePositiveNumber(fineractLoan?.netDisbursalAmount) ??
          coercePositiveNumber(fineractLoan?.approvedPrincipal) ??
          coercePositiveNumber(fineractLoan?.principal);
      }
      augmentedPayload.note = callbackUrl;
    }

    // Log the payload being sent to Fineract
    console.log('=== DISBURSEMENT PAYLOAD ===');
    console.log('Loan ID:', id);
    console.log('Yango USSD disbursement:', Boolean(yangoUssdDetails));
    console.log('Payload sent to Fineract:', JSON.stringify(augmentedPayload, null, 2));
    console.log('=== END DISBURSEMENT PAYLOAD ===');

    // Check if this is a cash disbursement and verify session closure compliance
    // Use the payment type actually sent to Fineract (Yango may override it).
    // Fail closed: if module is on and we need to verify payment type, error if lookup fails.
    let isCash = false;
    if (tenant) {
      const settings = await getCashierSessionTenantSettings(tenant.id);
      if (settings.isTellerManagementModuleOn && augmentedPayload.paymentTypeId) {
        const paymentTypeInfo = await getPaymentTypeInfo(Number(augmentedPayload.paymentTypeId));
        if (paymentTypeInfo === null) {
          return NextResponse.json(
            {
              error: "Could not verify the payment type. Please try again.",
              code: "PAYMENT_TYPE_LOOKUP_FAILED",
            },
            { status: 503 }
          );
        }
        isCash = paymentTypeInfo.isCashPayment ?? false;
      }
    }
    if (tenant) {
      const gate = await checkCashDisbursementSessionGate({
        tenantId: tenant.id,
        isCash,
        fineractUserId: session.user.userId,
      });
      if (!gate.allowed) {
        return NextResponse.json(
          {
            error: gate.message,
            code: gate.code,
            blockingSessions: gate.blockingSessions,
          },
          { status: gate.status }
        );
      }
    }

    // POST to /loans/{id}?command=disburse with payload
    const data = await runArdaStockDisbursementGuard({
      appTenantSlug: tenant?.slug || tenantSlug,
      tenantSettings: tenant?.settings,
      fineractLoanId: Number(id),
      getDetails: () =>
        linkedLead ? getArdaStockDetails({ ...linkedLead, tenant }) : null,
      disburse: () => fetchFineractAPI(`/loans/${id}?command=disburse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(augmentedPayload),
      }),
    });

    // Non-blocking: do not fail disbursement if charge application fails.
    try {
      if (tenant) {
        await applyTopupDisbursementCharges({
          loanId: Number(id),
          tenantId: tenant.id,
          source: 'loan-disburse-route',
          disbursedAmount:
            typeof payload?.transactionAmount === 'number'
              ? payload.transactionAmount
              : Number(payload?.transactionAmount) || undefined,
        });
      } else {
        console.warn('[TopupDisbursementCharges] Tenant not found in disburse route', {
          loanId: id,
          tenantSlug,
        });
      }
    } catch (chargeError) {
      console.error('[TopupDisbursementCharges] Failed in disburse route:', chargeError);
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('Error disbursing loan:', error);

    const structuredError =
      typeof error === 'object' && error !== null
        ? (error as {
            status?: number;
            message?: string;
            errorData?: unknown;
          })
        : null;

    // Return structured backend error when available
    if (structuredError?.status && structuredError.errorData) {
      return NextResponse.json(
        {
          error: structuredError.message || 'API error',
          status: structuredError.status,
          errorData: structuredError.errorData,
        },
        { status: structuredError.status }
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
