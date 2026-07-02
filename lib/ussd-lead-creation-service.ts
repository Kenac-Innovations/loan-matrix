import prisma from "@/lib/prisma";
import {
  buildLeadClientBackfillData,
  buildLeadDataFromUssdApplication,
} from "@/lib/ussd-lead-conversion";
import { resolveUssdApplicationFineractClient } from "@/lib/ussd-fineract-client";

type UssdApplicationRecord = Awaited<
  ReturnType<typeof prisma.ussdLoanApplication.findFirst>
>;

function assertApplication(
  application: UssdApplicationRecord
): asserts application is NonNullable<UssdApplicationRecord> {
  if (!application) {
    throw new Error("USSD application is required");
  }
}

async function findInitialStageId(tenantId: string): Promise<string | null> {
  const initialStage = await prisma.pipelineStage.findFirst({
    where: {
      tenantId,
      isInitialState: true,
      isActive: true,
    },
    select: { id: true },
  });

  return initialStage?.id ?? null;
}

async function findExistingLeadForApplication(
  application: NonNullable<UssdApplicationRecord>
) {
  return prisma.lead.findFirst({
    where: {
      tenantId: application.tenantId,
      OR: [
        {
          stateMetadata: {
            path: ["applicationId"],
            equals: application.loanApplicationUssdId,
          },
        },
        {
          stateMetadata: {
            path: ["referenceNumber"],
            equals: application.referenceNumber,
          },
        },
        {
          stateMetadata: {
            path: ["messageId"],
            equals: application.messageId,
          },
        },
      ],
    },
  });
}

export async function createOrReuseLeadFromUssdApplication(
  application: UssdApplicationRecord,
  options?: {
    currentUserId?: string;
  }
) {
  assertApplication(application);

  const initialStageId = await findInitialStageId(application.tenantId);
  const existing = await findExistingLeadForApplication(application);

  if (existing) {
    if (!existing.fineractClientId || !existing.clientCreatedInFineract) {
      const fineractClient = await resolveUssdApplicationFineractClient(
        application
      );
      const backfill = buildLeadClientBackfillData(application, fineractClient);

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

    return { leadId: existing.id, existed: true };
  }

  const fineractClient = await resolveUssdApplicationFineractClient(application);
  const lead = await prisma.lead.create({
    data: {
      ...buildLeadDataFromUssdApplication(
        application,
        options?.currentUserId || "system",
        fineractClient
      ),
      ...(initialStageId ? { currentStageId: initialStageId } : {}),
    },
    select: { id: true },
  });

  return { leadId: lead.id, existed: false };
}
