import { NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';
import prisma from '@/lib/prisma';
import { applyTopupDisbursementCharges } from '@/lib/topup-disbursement-charge-service';
import { extractTenantSlugFromRequest, getTenantBySlug } from '@/lib/tenant-service';

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

    // Try to enrich payload using USSD application linked via loan externalId
    let ussdPhone: string | undefined;
    let isUssdLinked = false;
    try {
      const loan = await fetchFineractAPI(`/loans/${id}`);
      const externalId = loan?.externalId;
      if (externalId) {
        const ussd = await prisma.ussdLoanApplication.findFirst({
          where: { id: String(externalId) },
          select: { userPhoneNumber: true },
        });
        isUssdLinked = Boolean(ussd);
        ussdPhone = ussd?.userPhoneNumber || undefined;
      }
    } catch {}
    // Build callback URL to be used by payment gateway
    //const callbackUrl = `https://webhook.site/45f26e26-5c80-4290-9a1a-87b60be151a4`;
    // Use specific callback URL for payment gateway
    const callbackUrl = `http://loan-matrix-dev.loan-matrix-dev.svc.cluster.local:3000/api/ussd-leads/payment-callback`;

    const augmentedPayload: Record<string, unknown> = {
      ...payload,
    };

    // Only USSD-linked loans need the gateway callback details.
    if (isUssdLinked) {
      if (ussdPhone) {
        augmentedPayload.accountNumber = ussdPhone;
      }
      augmentedPayload.note = callbackUrl;
    }

    // Log the payload being sent to Fineract
    console.log('=== DISBURSEMENT PAYLOAD ===');
    console.log('Loan ID:', id);
    console.log('USSD linked:', isUssdLinked);
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
      const tenantSlug = extractTenantSlugFromRequest(request);
      const tenant = await getTenantBySlug(tenantSlug);
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
  } catch (error: any) {
    console.error('Error disbursing loan:', error);

    // Return structured backend error when available
    if (error.status && error.errorData) {
      return NextResponse.json(
        {
          error: error.message || 'API error',
          status: error.status,
          errorData: error.errorData,
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
