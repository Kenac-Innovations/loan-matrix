import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * POST /api/ussd-leads/payment-callback
 * Public webhook to update payment status for a USSD application.
 * Expected JSON: { 
 *   status: string, 
 *   message: string, 
 *   transactionReference: string, // Contains the externalId (UssdLoanApplication.id)
 *   customer: string, 
 *   amount: string 
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { status, message, transactionReference, customer, amount } = body || {};

    // Validate required fields
    if (!status || typeof status !== 'string') {
      return NextResponse.json({ error: 'status is required' }, { status: 400 });
    }
    if (!transactionReference || typeof transactionReference !== 'string') {
      return NextResponse.json({ error: 'transactionReference is required' }, { status: 400 });
    }

    // transactionReference contains the externalId (UssdLoanApplication.id)
    const externalId = transactionReference;

    // Find the USSD application by externalId
    const app = await prisma.ussdLoanApplication.findFirst({ where: { id: externalId } });
    if (!app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    // Prepare metadata with all the payment gateway data
    const metadata = {
      message,
      transactionReference,
      customer,
      amount,
      receivedAt: new Date().toISOString(),
    };

    // Update the USSD application with payment status and metadata
    await prisma.ussdLoanApplication.update({
      where: { id: externalId },
      data: {
        paymentStatus: status,
        processingNotes: JSON.stringify(metadata).slice(0, 1000), // Store full metadata
        updatedAt: new Date(),
      },
    });

    console.log(`Payment callback processed: ${externalId} -> ${status}`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Payment callback error:', error);
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 });
  }
}


