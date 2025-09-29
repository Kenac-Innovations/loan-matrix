import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * POST /api/ussd-leads/payment-callback
 * Public webhook to update payment status for a USSD application.
 * Expected JSON: { externalId: string, status: string, metadata?: any }
 * externalId should be the UssdLoanApplication.id (string) we sent as loan externalId.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { externalId, status, metadata } = body || {};

    if (!externalId || typeof externalId !== 'string') {
      return NextResponse.json({ error: 'externalId is required' }, { status: 400 });
    }
    if (!status || typeof status !== 'string') {
      return NextResponse.json({ error: 'status is required' }, { status: 400 });
    }

    const app = await prisma.ussdLoanApplication.findFirst({ where: { id: externalId } });
    if (!app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    await prisma.ussdLoanApplication.update({
      where: { id: externalId },
      data: {
        paymentStatus: status,
        processingNotes: metadata ? JSON.stringify(metadata).slice(0, 1000) : undefined,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Payment callback error:', error);
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 });
  }
}


