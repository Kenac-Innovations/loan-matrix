type UssdApplicationIdentity = {
  loanApplicationUssdId: number;
  referenceNumber?: string | null;
  messageId?: string | null;
};

type LinkedLeadRecord = {
  id: string;
  stateMetadata?: unknown;
  currentStage?: {
    name: string;
  } | null;
};

export type UssdLinkedLeadSummary = {
  leadId: string;
  currentStageName?: string | null;
};

function toCleanString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toApplicationId(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Number(value);
  }

  return null;
}

function readStateMetadata(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  return metadata as Record<string, unknown>;
}

export function buildUssdLinkedLeadLookup(
  applications: UssdApplicationIdentity[],
  leads: LinkedLeadRecord[]
): Map<number, UssdLinkedLeadSummary> {
  const summaries = new Map<number, UssdLinkedLeadSummary>();
  const applicationIdByReferenceNumber = new Map<string, number>();
  const applicationIdByMessageId = new Map<string, number>();

  for (const application of applications) {
    const referenceNumber = toCleanString(application.referenceNumber);
    const messageId = toCleanString(application.messageId);

    if (referenceNumber) {
      applicationIdByReferenceNumber.set(
        referenceNumber,
        application.loanApplicationUssdId
      );
    }

    if (messageId) {
      applicationIdByMessageId.set(messageId, application.loanApplicationUssdId);
    }
  }

  for (const lead of leads) {
    const metadata = readStateMetadata(lead.stateMetadata);
    const applicationId =
      toApplicationId(metadata.applicationId) ??
      applicationIdByReferenceNumber.get(
        toCleanString(metadata.referenceNumber) || ""
      ) ??
      applicationIdByMessageId.get(toCleanString(metadata.messageId) || "");

    if (!applicationId || summaries.has(applicationId)) {
      continue;
    }

    summaries.set(applicationId, {
      leadId: lead.id,
      currentStageName: lead.currentStage?.name ?? null,
    });
  }

  return summaries;
}
