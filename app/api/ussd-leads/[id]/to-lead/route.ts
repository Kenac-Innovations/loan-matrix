import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { createOrReuseLeadFromUssdApplication } from '@/lib/ussd-lead-creation-service';

/**
 * POST /api/ussd-leads/[id]/to-lead
 * Creates a CRM Lead from a USSD loan application and returns the lead id.
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

    // Load USSD application by public id
    const app = await prisma.ussdLoanApplication.findFirst({
      where: { loanApplicationUssdId: applicationId },
    });

    if (!app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    const session = await getSession();
    const result = await createOrReuseLeadFromUssdApplication(app, {
      currentUserId: session?.user?.id || 'system',
    });

    return NextResponse.json({
      success: true,
      leadId: result.leadId,
      existed: result.existed,
    });
  } catch (error: any) {
    console.error('Error creating Lead from USSD application:', error);
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 });
  }
}
