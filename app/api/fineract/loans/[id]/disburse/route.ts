import { NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import {
  applyLeadVisibilityScope,
  getDisbursementBlockReason,
  getLeadViewerAccessContext,
} from '@/lib/lead-policy';
import { applyTopupDisbursementCharges } from '@/lib/topup-disbursement-charge-service';
import { getRequiredPaymentServiceCallbackUrl } from '@/lib/payment-service-callback-url';
import { extractTenantSlugFromRequest, getTenantBySlug } from '@/lib/tenant-service';
import { resolveYangoUssdDisbursementDetailsForLead } from '@/lib/yango-ussd-disbursement';

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

      const linkedLead = leadRecord
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
    const yangoUssdDetails =
      tenant
        ? await prisma.lead
            .findFirst({
              where: {
                tenantId: tenant.id,
                fineractLoanId: Number(id),
              },
              select: {
                id: true,
                tenantId: true,
                stateMetadata: true,
                loanProductId: true,
                loanProductName: true,
                mobileNo: true,
                accountNumber: true,
                preferredPaymentMethod: true,
              },
            })
            .then((lead) =>
              lead
                ? resolveYangoUssdDisbursementDetailsForLead(
                    lead,
                    numericPaymentTypeId
                  )
                : null
            )
        : null;

    if (yangoUssdDetails) {
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
      augmentedPayload.note = getRequiredPaymentServiceCallbackUrl();
    }

    // Log the payload being sent to Fineract
    console.log('=== DISBURSEMENT PAYLOAD ===');
    console.log('Loan ID:', id);
    console.log('Yango USSD disbursement:', Boolean(yangoUssdDetails));
    console.log('Payload sent to Fineract:', JSON.stringify(augmentedPayload, null, 2));
    console.log('=== END DISBURSEMENT PAYLOAD ===');

    // POST to /loans/{id}?command=disburse with payload
    const data = await fetchFineractAPI(`/loans/${id}?command=disburse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(augmentedPayload),
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
