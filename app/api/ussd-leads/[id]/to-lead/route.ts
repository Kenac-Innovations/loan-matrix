import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import {
  buildLeadClientBackfillData,
  buildLeadDataFromUssdApplication,
  getUssdLeadLookupExternalIds,
} from '@/lib/ussd-lead-conversion';
import { resolveUssdApplicationFineractClient } from '@/lib/ussd-fineract-client';

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

    const initialStage = await prisma.pipelineStage.findFirst({
      where: {
        tenantId: app.tenantId,
        isInitialState: true,
        isActive: true,
      },
      select: { id: true },
    });
    const initialStageId = initialStage?.id ?? null;

    const lookupExternalIds = getUssdLeadLookupExternalIds(app);

    // Attempt to find existing lead by the stable external ids we know for this applicant.
    const existing = await prisma.lead.findFirst({
      where: {
        tenantId: app.tenantId,
        OR: lookupExternalIds.map((externalId) => ({ externalId })),
      },
    });
    if (existing) {
      if (!existing.fineractClientId || !existing.clientCreatedInFineract) {
        const fineractClient = await resolveUssdApplicationFineractClient(app);
        const backfill = buildLeadClientBackfillData(app, fineractClient);
        await prisma.lead.update({
          where: { id: existing.id },
          data: {
            ...backfill,
            ...(existing.currentStageId == null && initialStageId
              ? { currentStageId: initialStageId }
              : {}),
          },
        });
      } else if (existing.currentStageId == null && initialStageId) {
        await prisma.lead.update({
          where: { id: existing.id },
          data: { currentStageId: initialStageId },
        });
      }

      return NextResponse.json({ success: true, leadId: existing.id, existed: true });
    }

    // Resolve current user for required Lead.userId
    const session = await getSession();
    const currentUserId = session?.user?.id || 'system';
    const fineractClient = await resolveUssdApplicationFineractClient(app);

    // Create a new lead already linked to the existing Fineract client when Rabbit provided it.
    const lead = await prisma.lead.create({
      data: {
        ...buildLeadDataFromUssdApplication(app, currentUserId, fineractClient),
        ...(initialStageId ? { currentStageId: initialStageId } : {}),
      },
      select: { id: true },
    });

    return NextResponse.json({ success: true, leadId: lead.id });
  } catch (error: any) {
    console.error('Error creating Lead from USSD application:', error);
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 });
  }
}
