import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

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

    // Attempt to find existing lead by externalId/reference mapping to avoid duplicates
    const existing = await prisma.lead.findFirst({
      where: {
        tenantId: app.tenantId,
        OR: [
          { externalId: app.referenceNumber },
          { externalId: app.messageId },
        ],
      },
    });
    if (existing) {
      return NextResponse.json({ success: true, leadId: existing.id, existed: true });
    }

    // Map full name to first/last (best-effort)
    const parts = (app.userFullName || '').trim().split(/\s+/);
    const firstname = parts[0] || '';
    const lastname = parts.slice(1).join(' ') || undefined;

    // Resolve current user for required Lead.userId
    const session = await getSession();
    const currentUserId = session?.user?.id || 'system';

    // Create a new Lead using available USSD fields
    const lead = await prisma.lead.create({
      data: {
        tenantId: app.tenantId,
        userId: currentUserId,
        status: 'DRAFT',
        externalId: app.referenceNumber || app.messageId,
        firstname,
        lastname,
        mobileNo: app.userPhoneNumber,
        requestedAmount: app.principalAmount,
        loanTerm: app.loanTermMonths,
        // Optional hints
        bankName: app.bankName || undefined,
        accountNumber: app.bankAccountNumber || undefined,
        officeName: app.branchName || undefined,
        // Store source information in stateMetadata for traceability
        stateMetadata: {
          source: 'USSD',
          applicationId: app.loanApplicationUssdId,
          messageId: app.messageId,
          referenceNumber: app.referenceNumber,
          payoutMethod: app.payoutMethod,
        },
      },
      select: { id: true },
    });

    return NextResponse.json({ success: true, leadId: lead.id });
  } catch (error: any) {
    console.error('Error creating Lead from USSD application:', error);
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 });
  }
}



