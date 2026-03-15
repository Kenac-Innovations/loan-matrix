import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/ussd-leads/by-id/[id]
 * Fetches a USSD loan application by its primary key ID (string)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const application = await prisma.ussdLoanApplication.findUnique({
      where: { id },
    });

    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    return NextResponse.json(application);
  } catch (error: any) {
    console.error('Error fetching USSD application by ID:', error);
    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
