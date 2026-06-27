import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchFineractAPI } from '@/lib/api';
import { format } from 'date-fns';
import {
  buildLeadClientBackfillData,
  buildUssdLoanPayloadFromTemplate,
  resolveUssdLoanExternalId,
} from '@/lib/ussd-lead-conversion';
import { resolveUssdApplicationFineractClient } from '@/lib/ussd-fineract-client';

/**
 * POST /api/ussd-leads/[id]/submit
 * Creates a Fineract loan using data from USSD application and returns the core response.
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

    // Optional payload from caller (leadId override for externalId)
    let incoming: Record<string, unknown> = {};
    try {
      const parsed = await request.json();
      if (parsed && typeof parsed === "object") {
        incoming = parsed as Record<string, unknown>;
      }
    } catch {
      // Ignore malformed optional payloads.
    }

    const leadId = typeof incoming.leadId === "string" ? incoming.leadId : null;

    // Load application by loanApplicationUssdId
    const app = await prisma.ussdLoanApplication.findFirst({
      where: { loanApplicationUssdId: applicationId },
    });

    if (!app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    // Determine submitted and expected disbursement dates
    let baseDate = app.queuedAt ?? app.createdAt ?? new Date();
    const coerceValidDate = (d: Date): Date => {
      if (!(d instanceof Date) || isNaN(d.getTime())) return new Date();
      // Avoid epoch/placeholder values
      if (d.getFullYear() < 2000) return new Date();
      return d;
    };
    baseDate = coerceValidDate(new Date(baseDate));

    let fineractClient: Record<string, any> | null = null;

    // Align with client's activation date to satisfy domain rule
    if (app.loanMatrixClientId) {
      try {
        const client = await fetchFineractAPI(
          `/clients/${app.loanMatrixClientId}`
        );
        fineractClient = client;
        const activationArr = client?.timeline?.activationDate as
          | number[]
          | undefined;
        if (Array.isArray(activationArr) && activationArr.length >= 3) {
          const [y, m, d] = activationArr;
          let activationDate = new Date(
            y as number,
            (m as number) - 1,
            d as number
          );
          activationDate = coerceValidDate(activationDate);
          if (baseDate < activationDate) baseDate = activationDate;
        }
      } catch {
        // If we can't load client, continue with current baseDate
      }
    }

    // Finalize dates with validation
    let dateStr = format(baseDate, 'yyyy-MM-dd');
    if (!dateStr || dateStr.includes('Invalid')) {
      baseDate = new Date();
      dateStr = format(baseDate, 'yyyy-MM-dd');
    }

    // Debug (server log only)
    console.log('[USSD Submit] Dates used', {
      appQueuedAt: app.queuedAt,
      appCreatedAt: app.createdAt,
      baseDateISO: baseDate.toISOString(),
      dateStr,
    });

    const stableExternalId =
      resolveUssdLoanExternalId({
        leadId,
        applicationRecordId: app.id,
        referenceNumber: app.referenceNumber,
        messageId: app.messageId,
      }) ?? undefined;

    const productTemplate = await fetchFineractAPI(
      `/loanproducts/${app.loanMatrixLoanProductId}?template=true`,
      { authMode: 'service' }
    );

    const payload = buildUssdLoanPayloadFromTemplate(
      app,
      productTemplate as Record<string, unknown>,
      {
        dateStr,
        externalId: stableExternalId,
      }
    );

    // POST to Fineract /loans
    const result = await fetchFineractAPI('/loans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (result && result.resourceId) {
      const loanId = result.resourceId;
      
      if (stableExternalId) {
        try {
          await fetchFineractAPI(`/loans/${loanId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              externalId: stableExternalId,
              locale: 'en',
              dateFormat: 'yyyy-MM-dd',
            }),
          });
          
          console.log(`Updated loan ${loanId} with stable external ID ${stableExternalId}`);
        } catch (updateError) {
          console.error('Failed to update loan external ID:', updateError);
          // Don't fail the entire operation if external ID update fails
        }
      }

      if (leadId) {
        const existingLead = await prisma.lead.findUnique({
          where: { id: leadId },
          select: { stateMetadata: true },
        });

        const resolvedClient =
          fineractClient ?? (await resolveUssdApplicationFineractClient(app));
        const backfill = buildLeadClientBackfillData(app, resolvedClient);
        const {
          stateMetadata: backfillStateMetadata,
          ...backfillFields
        } = backfill as Record<string, unknown>;

        await prisma.lead.update({
          where: { id: leadId },
          data: {
            ...backfillFields,
            fineractLoanId: loanId,
            loanSubmittedToFineract: true,
            loanSubmissionDate: new Date(),
            stateMetadata: {
              ...((existingLead?.stateMetadata as Record<string, unknown>) || {}),
              ...((backfillStateMetadata as Record<string, unknown>) || {}),
              loanCreatedAt: new Date().toISOString(),
              loanExternalId: stableExternalId ?? null,
              loanId,
            },
          },
        });
      }
    }

    return NextResponse.json({ success: true, coreResponse: result });
  } catch (error: unknown) {
    type LoanCreationError = {
      status?: number;
      errorData?: {
        defaultUserMessage?: string;
        errors?: Array<{ defaultUserMessage?: string }>;
      };
      message?: string;
    };
    const loanCreationError = error as LoanCreationError;
    console.error('Error creating loan from USSD application:', loanCreationError);
    if (loanCreationError.status && loanCreationError.errorData) {
      return NextResponse.json(
        { error: loanCreationError.message, status: loanCreationError.status, errorData: loanCreationError.errorData },
        { status: loanCreationError.status }
      );
    }
    return NextResponse.json({ error: loanCreationError.message || 'Unknown error' }, { status: 500 });
  }
}
