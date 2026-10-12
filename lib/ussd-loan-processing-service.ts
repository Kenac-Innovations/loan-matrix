import { format } from "date-fns";

import { fetchFineractAPI } from "@/lib/api";
import { callCDEAndStore } from "@/lib/cde-utils";
import prisma from "@/lib/prisma";
import { TeamAwareStateMachineService } from "@/lib/team-state-machine-service";
import { dispatchUssdLoanApplicationSms } from "@/lib/ussd-loan-sms-service";
import {
  classifyUssdAutoProcessingOutcome,
  shouldAutoProgressFromCde,
  type UssdAutoProcessingStatus,
} from "@/lib/ussd-auto-processing-policy";
import {
  buildLeadClientBackfillData,
  buildUssdLoanPayloadFromTemplate,
  resolveUssdLoanExternalId,
} from "@/lib/ussd-lead-conversion";
import { createOrReuseLeadFromUssdApplication } from "@/lib/ussd-lead-creation-service";
import { resolveUssdApplicationFineractClient } from "@/lib/ussd-fineract-client";
import {
  fetchLoansByExternalId,
  isDuplicateLoanCreationError,
  resolveReusableUssdLoanId,
} from "@/lib/ussd-loan-submission";

export type UssdLoanProcessingResult = {
  success: boolean;
  leadId: string;
  loanId: number;
  coreResponse: Record<string, unknown> | null;
  cdeResult: Record<string, unknown> | null;
  cdeDecision: string | null;
  autoProgressMessage: string | null;
  status: UssdAutoProcessingStatus;
};

type UssdLoanApplicationRecord = NonNullable<
  Awaited<ReturnType<typeof prisma.ussdLoanApplication.findFirst>>
>;

function coerceValidDate(value: Date): Date {
  if (
    !(value instanceof Date) ||
    Number.isNaN(value.getTime()) ||
    value.getFullYear() < 2000
  ) {
    return new Date();
  }

  return value;
}

function readCdeDecision(
  cdeResult: Record<string, unknown> | null
): string | null {
  return typeof cdeResult?.decision === "string"
    ? cdeResult.decision
    : null;
}

function isRejectedCdeDecision(decision: string | null): boolean {
  return ["REJECTED", "DECLINED"].includes(
    decision?.trim().toUpperCase() || ""
  );
}

function isNumericUserId(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0;
}

function resolveUssdAutomationUserId(triggeredBy: string | null | undefined) {
  if (isNumericUserId(triggeredBy)) {
    return String(triggeredBy);
  }

  const configuredUserId =
    process.env.USSD_AUTO_PROCESSING_USER_ID ||
    process.env.FINERACT_SERVICE_USER_ID ||
    "1";

  return isNumericUserId(configuredUserId) ? configuredUserId : "1";
}

function resolveUssdAutomationUserName() {
  return (
    process.env.USSD_AUTO_PROCESSING_USER_NAME ||
    process.env.FINERACT_SERVICE_USER_NAME ||
    "App Administrator"
  );
}

function buildAutomationOriginatorPatch(lead: {
  userId?: string | null;
  createdByUserName?: string | null;
}) {
  if (isNumericUserId(lead.userId)) {
    return {};
  }

  return {
    userId: resolveUssdAutomationUserId(lead.userId),
    createdByUserName:
      lead.createdByUserName || resolveUssdAutomationUserName(),
  };
}

export async function processUssdApplicationToDisbursement(input: {
  application: UssdLoanApplicationRecord;
  leadId?: string | null;
  triggeredBy?: string;
}): Promise<UssdLoanProcessingResult> {
  const application = input.application;
  const automationUserId = resolveUssdAutomationUserId(input.triggeredBy);
  const leadResult = await createOrReuseLeadFromUssdApplication(application, {
    currentUserId: automationUserId,
  });
  const leadId = input.leadId || leadResult.leadId;

  let baseDate = coerceValidDate(
    new Date(application.queuedAt ?? application.createdAt ?? new Date())
  );
  let fineractClient: Record<string, unknown> | null = null;

  if (application.loanMatrixClientId) {
    try {
      fineractClient = await fetchFineractAPI(
        `/clients/${application.loanMatrixClientId}`,
        { authMode: "service" }
      );
      const activationDate = (
        fineractClient as {
          timeline?: { activationDate?: number[] };
        }
      )?.timeline?.activationDate;

      if (Array.isArray(activationDate) && activationDate.length >= 3) {
        const [year, month, day] = activationDate;
        const clientActivationDate = coerceValidDate(
          new Date(year, month - 1, day)
        );
        if (baseDate < clientActivationDate) {
          baseDate = clientActivationDate;
        }
      }
    } catch (error) {
      console.warn(
        "[USSD Auto Processing] Could not load Fineract client timeline:",
        error
      );
    }
  }

  const dateStr = format(baseDate, "yyyy-MM-dd");
  const stableExternalId =
    resolveUssdLoanExternalId({
      leadId,
      applicationRecordId: application.id,
      referenceNumber: application.referenceNumber,
      messageId: application.messageId,
    }) ?? undefined;

  const leadSnapshot = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      fineractLoanId: true,
      loanSubmittedToFineract: true,
      stateMetadata: true,
      userId: true,
      createdByUserName: true,
    },
  });
  const reusableLeadState = leadSnapshot
    ? {
        fineractLoanId: leadSnapshot.fineractLoanId,
        loanSubmittedToFineract: leadSnapshot.loanSubmittedToFineract,
        stateMetadata:
          leadSnapshot.stateMetadata &&
          typeof leadSnapshot.stateMetadata === "object" &&
          !Array.isArray(leadSnapshot.stateMetadata)
            ? (leadSnapshot.stateMetadata as Record<string, unknown>)
            : null,
      }
    : null;

  let reusableLoanId: number | null = null;
  if (stableExternalId) {
    try {
      const loansByExternalId = await fetchLoansByExternalId(stableExternalId);
      reusableLoanId = resolveReusableUssdLoanId({
        lead: reusableLeadState,
        externalId: stableExternalId,
        loansByExternalId,
      });
    } catch (error) {
      console.warn(
        "[USSD Auto Processing] Existing-loan lookup failed:",
        error
      );
    }
  } else {
    reusableLoanId = resolveReusableUssdLoanId({ lead: reusableLeadState });
  }

  let coreResponse: Record<string, unknown> | null = null;
  let loanId = reusableLoanId;

  if (!loanId) {
    const productTemplate = await fetchFineractAPI(
      `/loanproducts/${application.loanMatrixLoanProductId}?template=true`,
      { authMode: "service" }
    );
    const payload = buildUssdLoanPayloadFromTemplate(
      application,
      productTemplate as Record<string, unknown>,
      {
        dateStr,
        externalId: stableExternalId,
      }
    );

    try {
      coreResponse = await fetchFineractAPI("/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        authMode: "service",
      });
      loanId =
        (coreResponse as { resourceId?: number | null } | null)?.resourceId ??
        null;
    } catch (error) {
      if (!stableExternalId || !isDuplicateLoanCreationError(error)) {
        throw error;
      }

      const loansByExternalId = await fetchLoansByExternalId(stableExternalId);
      loanId = resolveReusableUssdLoanId({
        lead: reusableLeadState,
        externalId: stableExternalId,
        loansByExternalId,
      });

      if (!loanId) {
        throw error;
      }
    }
  }

  if (!loanId) {
    throw new Error(
      "Failed to resolve or create Fineract loan for USSD application"
    );
  }

  const existingLead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { stateMetadata: true },
  });

  if (reusableLoanId && stableExternalId) {
    try {
      await fetchFineractAPI(`/loans/${loanId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          externalId: stableExternalId,
          locale: "en",
          dateFormat: "yyyy-MM-dd",
        }),
        authMode: "service",
      });
    } catch (error) {
      console.error(
        "[USSD Auto Processing] Failed to update loan external ID:",
        error
      );
    }
  }

  const resolvedClient =
    fineractClient ??
    (await resolveUssdApplicationFineractClient(application));
  const backfill = buildLeadClientBackfillData(application, resolvedClient);
  const {
    stateMetadata: backfillStateMetadata,
    ...backfillFields
  } = backfill as Record<string, unknown>;

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      ...backfillFields,
      ...buildAutomationOriginatorPatch({
        userId: leadSnapshot?.userId,
        createdByUserName: leadSnapshot?.createdByUserName,
      }),
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

  dispatchUssdLoanApplicationSms({
    applicationId: application.id,
    tenantId: application.tenantId,
    userFullName: application.userFullName,
    userPhoneNumber: application.userPhoneNumber,
    principalAmount: application.principalAmount,
    referenceNumber: application.referenceNumber,
    event: "submission",
  });

  const cdeResult = (await callCDEAndStore(leadId)) as Record<
    string,
    unknown
  > | null;
  const cdeDecision = readCdeDecision(cdeResult);

  if (isRejectedCdeDecision(cdeDecision)) {
    dispatchUssdLoanApplicationSms({
      applicationId: application.id,
      tenantId: application.tenantId,
      userFullName: application.userFullName,
      userPhoneNumber: application.userPhoneNumber,
      principalAmount: application.principalAmount,
      referenceNumber: application.referenceNumber,
      event: "rejection",
    });
  }

  let autoProgressMessage: string | null = null;

  if (shouldAutoProgressFromCde(cdeDecision)) {
    autoProgressMessage =
      await TeamAwareStateMachineService.autoProgressToDisbursementFromCdeResult(
        leadId,
        automationUserId,
        cdeResult
      );
  }

  const status = classifyUssdAutoProcessingOutcome({
    cdeDecision,
    autoProgressMessage,
  });

  return {
    success: status === "completed",
    leadId,
    loanId,
    coreResponse,
    cdeResult,
    cdeDecision,
    autoProgressMessage,
    status,
  };
}
