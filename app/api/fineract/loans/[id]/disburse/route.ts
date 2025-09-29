import { NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';
import prisma from '@/lib/prisma';

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

    // Resolve base URL for callback
    const url = new URL(request.url);
    const proto = url.protocol.replace(':', '') || 'http';
    const host = url.host;
    const base = `${proto}://${host}`;

    // Try to enrich payload using USSD application linked via loan externalId
    let ussdPhone: string | undefined;
    try {
      const loan = await fetchFineractAPI(`/loans/${id}`);
      const externalId = loan?.externalId;
      if (externalId) {
        const ussd = await prisma.ussdLoanApplication.findFirst({
          where: { id: String(externalId) },
          select: { userPhoneNumber: true },
        });
        ussdPhone = ussd?.userPhoneNumber || undefined;
      }
    } catch {}

    // Build callback URL to be used by payment gateway
    const callbackUrl = `${base}/api/ussd-leads/payment-callback`;

    // Augment payload per requirements (send only supported fields to Fineract)
    const augmentedPayload = {
      ...payload,
      accountNumber: ussdPhone ?? payload.accountNumber,
      note: callbackUrl,
    };

    // POST to /loans/{id}?command=disburse with payload
    const data = await fetchFineractAPI(`/loans/${id}?command=disburse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(augmentedPayload),
    });

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


