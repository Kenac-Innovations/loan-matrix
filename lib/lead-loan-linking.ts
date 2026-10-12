import type { Prisma } from "@/app/generated/prisma";

/**
 * Server-owned reconciliation for the Loan Matrix Lead <-> Fineract loan
 * relationship.
 *
 * A lead id is the idempotency key for manual loan submission.  This module is
 * deliberately independent of a route so that the browser submission path
 * and the Fineract CREATE webhook use the same tenant and client checks.
 */

export type LeadLoanRecord = {
  id: string;
  tenantId: string;
  fineractLoanId?: number | null;
  fineractClientId?: number | null;
  loanSubmittedToFineract?: boolean | null;
  loanSubmissionDate?: Date | string | null;
  clientCreatedInFineract?: boolean | null;
  clientCreationDate?: Date | string | null;
  stateMetadata?: unknown;
  [key: string]: unknown;
};

export type FineractLoanRecord = {
  id?: number | string | null;
  loanId?: number | string | null;
  resourceId?: number | string | null;
  externalId?: string | null;
  resourceExternalId?: string | null;
  clientId?: number | string | null;
  client?: { id?: number | string | null } | null;
  status?: {
    value?: string | null;
    code?: string | null;
    id?: number | string | null;
    [key: string]: unknown;
  } | string | null;
  loanStatus?: {
    value?: string | null;
    code?: string | null;
    id?: number | string | null;
    [key: string]: unknown;
  } | string | null;
  statusValue?: string | null;
  statusCode?: string | null;
  [key: string]: unknown;
};

export type LeadLoanLinkData = {
  fineractLoanId: number;
  fineractClientId: number;
  loanSubmittedToFineract: true;
  loanSubmissionDate: Date;
  clientCreatedInFineract: true;
  clientCreationDate: Date;
  stateMetadata: Record<string, unknown>;
};

export type LeadLoanLinkingAction =
  | "created"
  | "linked"
  | "already-linked"
  | "terminal";

export type LeadLoanLinkingResult = {
  success: boolean;
  action: LeadLoanLinkingAction;
  terminal: boolean;
  loanId: number;
  clientId: number;
  lead: LeadLoanRecord;
  remoteLoan: FineractLoanRecord;
  fineractResponse: unknown;
};

export type LeadLoanLinkingDependencies = {
  findLead: (input: {
    tenantId: string;
    leadId: string;
  }) => Promise<LeadLoanRecord | null>;
  searchLoansByExternalId: (
    externalId: string
  ) => Promise<unknown>;
  getLoanById?: (loanId: number) => Promise<unknown>;
  createLoan: (payload: Record<string, unknown>) => Promise<unknown>;
  persistLeadLink: (input: {
    tenantId: string;
    lead: LeadLoanRecord;
    data: LeadLoanLinkData;
  }) => Promise<LeadLoanRecord | null | void>;
};

export type ReconcileLeadLoanInput = {
  tenantId: string;
  leadId: string;
  /** The client id the submitted payload/event says this loan belongs to. */
  expectedClientId: number;
  fineractPayload?: Record<string, unknown> | null;
  /**
   * A loan supplied by the CREATE webhook.  It is already remote-created, so
   * it is validated and linked without issuing another POST.
   */
  remoteLoan?: FineractLoanRecord | null;
  /** Webhook callers must never create a loan when their event is incomplete. */
  allowCreate?: boolean;
  dependencies?: Partial<LeadLoanLinkingDependencies>;
};

export class LeadLoanLinkingError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    options: {
      status?: number;
      code?: string;
      details?: Record<string, unknown>;
    } = {}
  ) {
    super(message);
    this.name = "LeadLoanLinkingError";
    this.status = options.status ?? 409;
    this.code = options.code ?? "LEAD_LOAN_LINKING_CONFLICT";
    this.details = options.details;
  }
}

export class LeadLoanNotFoundError extends LeadLoanLinkingError {
  constructor(leadId: string, tenantId: string) {
    super("Lead not found in the requested tenant", {
      status: 404,
      code: "LEAD_NOT_FOUND",
      details: { leadId, tenantId },
    });
    this.name = "LeadLoanNotFoundError";
  }
}

export class LeadLoanPersistenceError extends LeadLoanLinkingError {
  readonly remoteLoanId: number;

  constructor(remoteLoanId: number, cause: unknown) {
    super(
      "Fineract created the loan, but Loan Matrix could not persist the durable lead link. Retry reconciliation before submitting again.",
      {
        status: 500,
        code: "LEAD_LOAN_LINK_PERSISTENCE_FAILED",
        details: {
          remoteLoanId,
          cause: cause instanceof Error ? cause.message : String(cause),
        },
      }
    );
    this.name = "LeadLoanPersistenceError";
    this.remoteLoanId = remoteLoanId;
  }
}

function toPositiveInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

function cleanString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned || null;
}

function getLoanId(loan: FineractLoanRecord | null | undefined): number | null {
  return toPositiveInt(loan?.id ?? loan?.loanId ?? loan?.resourceId);
}

function getLoanClientId(
  loan: FineractLoanRecord | null | undefined
): number | null {
  return toPositiveInt(loan?.clientId ?? loan?.client?.id);
}

function getLoanExternalId(
  loan: FineractLoanRecord | null | undefined
): string | null {
  return cleanString(loan?.externalId ?? loan?.resourceExternalId);
}

function normalizeSearchResults(value: unknown): FineractLoanRecord[] {
  if (Array.isArray(value)) return value as FineractLoanRecord[];
  if (
    value &&
    typeof value === "object" &&
    Array.isArray((value as { pageItems?: unknown }).pageItems)
  ) {
    return (value as { pageItems: FineractLoanRecord[] }).pageItems;
  }
  if (
    value &&
    typeof value === "object" &&
    Array.isArray((value as { content?: unknown }).content)
  ) {
    return (value as { content: FineractLoanRecord[] }).content;
  }
  if (
    value &&
    typeof value === "object" &&
    Array.isArray((value as { loans?: unknown }).loans)
  ) {
    return (value as { loans: FineractLoanRecord[] }).loans;
  }
  return [];
}

function statusText(loan: FineractLoanRecord | null | undefined): string {
  const statusValues = [
    typeof loan?.status === "string" ? loan.status : loan?.status?.value,
    typeof loan?.status === "string" ? null : loan?.status?.code,
    typeof loan?.loanStatus === "string"
      ? loan.loanStatus
      : loan?.loanStatus?.value,
    typeof loan?.loanStatus === "string" ? null : loan?.loanStatus?.code,
    loan?.statusValue,
    loan?.statusCode,
  ];

  return statusValues
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
}

export function isTerminalLeadLoan(loan: FineractLoanRecord | null | undefined) {
  const status = statusText(loan);
  return status.includes("reject") || status.includes("withdrawn");
}

function duplicateExternalIdError(error: unknown): boolean {
  const errorText = [
    error instanceof Error ? error.message : String(error ?? ""),
    typeof error === "object" && error !== null
      ? String((error as { statusText?: unknown }).statusText ?? "")
      : "",
    typeof error === "object" && error !== null
      ? JSON.stringify((error as { errorData?: unknown }).errorData ?? "")
      : "",
  ]
    .join(" ")
    .toLowerCase();

  return (
    errorText.includes("already exists") ||
    errorText.includes("already registered") ||
    errorText.includes("duplicate") ||
    errorText.includes("externalid") && errorText.includes("exist")
  );
}

function mergeStateMetadata(
  lead: LeadLoanRecord,
  loanId: number,
  leadId: string,
  linkedAt: Date
): Record<string, unknown> {
  const current =
    lead.stateMetadata && typeof lead.stateMetadata === "object"
      ? (lead.stateMetadata as Record<string, unknown>)
      : {};

  return {
    ...current,
    loanId,
    loanExternalId: leadId,
    loanCreatedAt: linkedAt.toISOString(),
  };
}

function buildLinkData(
  lead: LeadLoanRecord,
  loanId: number,
  clientId: number,
  linkedAt = new Date()
): LeadLoanLinkData {
  return {
    fineractLoanId: loanId,
    fineractClientId: clientId,
    loanSubmittedToFineract: true,
    loanSubmissionDate: linkedAt,
    clientCreatedInFineract: true,
    clientCreationDate:
      lead.clientCreationDate instanceof Date
        ? lead.clientCreationDate
        : lead.clientCreationDate
          ? new Date(lead.clientCreationDate)
          : linkedAt,
    stateMetadata: mergeStateMetadata(lead, loanId, lead.id, linkedAt),
  };
}

function getKnownLoanResponse(loan: FineractLoanRecord): unknown {
  return loan;
}

async function getDefaultDependencies(): Promise<LeadLoanLinkingDependencies> {
  // Keep these imports lazy.  Besides avoiding a database connection for pure
  // service consumers, this makes the reconciliation state machine easy to
  // test with in-memory dependencies.
  const [{ prisma }, { fetchFineractAPI }] = await Promise.all([
    import("@/lib/prisma"),
    import("@/lib/api"),
  ]);

  const findLead: LeadLoanLinkingDependencies["findLead"] = async ({
    tenantId,
    leadId,
  }) =>
    (await prisma.lead.findFirst({
      where: { id: leadId, tenantId },
    })) as LeadLoanRecord | null;

  const searchLoansByExternalId: LeadLoanLinkingDependencies["searchLoansByExternalId"] = async (
    externalId
  ) =>
    fetchFineractAPI(
      `/loans?externalId=${encodeURIComponent(externalId)}`,
      { authMode: "service", cache: "no-store" }
    );

  const getLoanById: NonNullable<
    LeadLoanLinkingDependencies["getLoanById"]
  > = async (loanId) =>
    fetchFineractAPI(`/loans/${loanId}?associations=all`, {
      authMode: "service",
      cache: "no-store",
    });

  const createLoan: LeadLoanLinkingDependencies["createLoan"] = async (
    payload
  ) =>
    fetchFineractAPI("/loans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

  const persistLeadLink: LeadLoanLinkingDependencies["persistLeadLink"] = async ({
    tenantId,
    lead,
    data,
  }) => {
    // Only an unlinked lead or the same exact remote loan may be updated.  A
    // retry that races another request therefore cannot overwrite a sibling
    // loan link.
    const prismaLinkData = {
      ...data,
      stateMetadata: data.stateMetadata as Prisma.InputJsonValue,
    } satisfies Prisma.LeadUpdateManyMutationInput;

    const updateResult = await prisma.lead.updateMany({
      where: {
        id: lead.id,
        tenantId,
        OR: [
          { fineractLoanId: null },
          {
            fineractLoanId: data.fineractLoanId,
            OR: [
              { fineractClientId: null },
              { fineractClientId: data.fineractClientId },
            ],
          },
        ],
      },
      data: prismaLinkData,
    });

    if (updateResult.count === 0) {
      const current = (await prisma.lead.findFirst({
        where: { id: lead.id, tenantId },
      })) as LeadLoanRecord | null;

      if (
        !current ||
        toPositiveInt(current.fineractLoanId) !== data.fineractLoanId ||
        toPositiveInt(current.fineractClientId) !== data.fineractClientId
      ) {
        throw new LeadLoanLinkingError(
          "The lead is already linked to a different Fineract loan or client",
          {
            status: 409,
            code: "LEAD_LOAN_LINK_CONFLICT",
            details: {
              leadId: lead.id,
              existingLoanId: current?.fineractLoanId ?? null,
              existingClientId: current?.fineractClientId ?? null,
              remoteLoanId: data.fineractLoanId,
              remoteClientId: data.fineractClientId,
            },
          }
        );
      }

      return current;
    }

    return (await prisma.lead.findFirst({
      where: { id: lead.id, tenantId },
    })) as LeadLoanRecord | null;
  };

  return {
    findLead,
    searchLoansByExternalId,
    getLoanById,
    createLoan,
    persistLeadLink,
  };
}

function ensureRemoteLoanIdentity(
  loan: FineractLoanRecord,
  leadId: string,
  expectedClientId: number
): { loanId: number; clientId: number } {
  const remoteExternalId = getLoanExternalId(loan);
  if (remoteExternalId !== leadId) {
    throw new LeadLoanLinkingError(
      "The Fineract loan does not have the requested lead external ID",
      {
        status: 409,
        code: "LEAD_LOAN_EXTERNAL_ID_CONFLICT",
        details: { leadId, remoteExternalId },
      }
    );
  }

  const loanId = getLoanId(loan);
  const clientId = getLoanClientId(loan);

  if (!loanId) {
    throw new LeadLoanLinkingError(
      "Fineract returned a loan without a usable loan ID",
      { code: "FINERACT_LOAN_ID_MISSING" }
    );
  }

  if (!clientId || clientId !== expectedClientId) {
    throw new LeadLoanLinkingError(
      "The Fineract loan belongs to a different client and was not linked",
      {
        status: 409,
        code: "LEAD_LOAN_CLIENT_CONFLICT",
        details: {
          expectedClientId,
          remoteClientId: clientId,
          remoteLoanId: loanId,
        },
      }
    );
  }

  return { loanId, clientId };
}

async function reconcileRemoteLoan(
  input: ReconcileLeadLoanInput,
  deps: LeadLoanLinkingDependencies,
  lead: LeadLoanRecord,
  remoteLoan: FineractLoanRecord,
  fineractResponse: unknown,
  action: "linked" | "already-linked"
): Promise<LeadLoanLinkingResult> {
  const { loanId, clientId } = ensureRemoteLoanIdentity(
    remoteLoan,
    input.leadId,
    input.expectedClientId
  );
  const localLoanId = toPositiveInt(lead.fineractLoanId);
  const localClientId = toPositiveInt(lead.fineractClientId);

  if (localLoanId && localLoanId !== loanId) {
    throw new LeadLoanLinkingError(
      "The lead is already linked to a different Fineract loan",
      {
        status: 409,
        code: "LEAD_LOAN_LINK_CONFLICT",
        details: { existingLoanId: localLoanId, remoteLoanId: loanId },
      }
    );
  }
  if (localClientId && localClientId !== clientId) {
    throw new LeadLoanLinkingError(
      "The lead is already linked to a different Fineract client",
      {
        status: 409,
        code: "LEAD_CLIENT_LINK_CONFLICT",
        details: { existingClientId: localClientId, remoteClientId: clientId },
      }
    );
  }

  const linkIsDurable =
    localLoanId === loanId &&
    localClientId === clientId &&
    lead.loanSubmittedToFineract === true &&
    Boolean(lead.loanSubmissionDate);

  let linkedLead = lead;
  if (!linkIsDurable) {
    const data = buildLinkData(lead, loanId, clientId);
    try {
      linkedLead =
        (await deps.persistLeadLink({
          tenantId: input.tenantId,
          lead,
          data,
        })) || {
          ...lead,
          ...data,
        };
    } catch (error) {
      if (error instanceof LeadLoanLinkingError) throw error;
      throw new LeadLoanPersistenceError(loanId, error);
    }
  }

  const terminal = isTerminalLeadLoan(remoteLoan);
  return {
    success: !terminal,
    action: terminal ? "terminal" : linkIsDurable ? "already-linked" : action,
    terminal,
    loanId,
    clientId,
    lead: linkedLead,
    remoteLoan,
    fineractResponse,
  };
}

/**
 * Find or create exactly one Fineract loan for one tenant-scoped Lead, then
 * persist its local link before returning success.
 */
export async function reconcileLeadLoan(
  input: ReconcileLeadLoanInput
): Promise<LeadLoanLinkingResult> {
  if (!input.tenantId || !input.leadId) {
    throw new LeadLoanLinkingError("Tenant and lead are required", {
      status: 400,
      code: "LEAD_LOAN_INPUT_INVALID",
    });
  }

  const expectedClientId = toPositiveInt(input.expectedClientId);
  if (!expectedClientId) {
    throw new LeadLoanLinkingError("A valid Fineract client ID is required", {
      status: 400,
      code: "LEAD_LOAN_CLIENT_REQUIRED",
    });
  }

  const suppliedDependencies = input.dependencies || {};
  const needsDefaults =
    !suppliedDependencies.findLead ||
    !suppliedDependencies.searchLoansByExternalId ||
    !suppliedDependencies.createLoan ||
    !suppliedDependencies.persistLeadLink;
  const defaults = needsDefaults ? await getDefaultDependencies() : {};
  const deps = {
    ...defaults,
    ...suppliedDependencies,
  } as LeadLoanLinkingDependencies;
  const lead = await deps.findLead({
    tenantId: input.tenantId,
    leadId: input.leadId,
  });

  if (!lead || lead.tenantId !== input.tenantId || lead.id !== input.leadId) {
    throw new LeadLoanNotFoundError(input.leadId, input.tenantId);
  }

  const localLoanId = toPositiveInt(lead.fineractLoanId);
  const localClientId = toPositiveInt(lead.fineractClientId);

  if (localClientId && localClientId !== expectedClientId) {
    throw new LeadLoanLinkingError(
      "The lead is already linked to a different Fineract client",
      {
        status: 409,
        code: "LEAD_CLIENT_LINK_CONFLICT",
        details: { existingClientId: localClientId, expectedClientId },
      }
    );
  }

  // A webhook supplies the already-created remote loan.  It must carry the
  // exact lead external ID and expected client, and it must never trigger POST.
  if (input.remoteLoan) {
    return reconcileRemoteLoan(
      input,
      deps,
      lead,
      input.remoteLoan,
      getKnownLoanResponse(input.remoteLoan),
      localLoanId ? "already-linked" : "linked"
    );
  }

  // A local link is never permission to trust a synthetic statusless object:
  // read the actual remote loan so a rejected/withdrawn loan remains a
  // terminal result on every retry.  This lookup path must never POST.
  if (localLoanId) {
    let localRemote: FineractLoanRecord | null = null;
    try {
      if (deps.getLoanById) {
        const fetched = await deps.getLoanById(localLoanId);
        localRemote =
          fetched && typeof fetched === "object"
            ? (fetched as FineractLoanRecord)
            : null;
      } else {
        const candidates = normalizeSearchResults(
          await deps.searchLoansByExternalId(input.leadId)
        );
        const matching = candidates.filter(
          (candidate) => getLoanId(candidate) === localLoanId
        );
        if (candidates.length === 1 && matching.length === 1) {
          localRemote = matching[0];
        }
      }
    } catch (error) {
      throw new LeadLoanLinkingError(
        "The existing Fineract loan could not be read for safe retry reconciliation",
        {
          status: 502,
          code: "FINERACT_LINKED_LOAN_LOOKUP_FAILED",
          details: {
            leadId: input.leadId,
            loanId: localLoanId,
            cause: error instanceof Error ? error.message : String(error),
          },
        }
      );
    }

    if (!localRemote) {
      throw new LeadLoanLinkingError(
        "The existing local loan link could not be matched to exactly one Fineract loan",
        {
          status: 409,
          code: "LEAD_LOAN_LINK_CONFLICT",
          details: { leadId: input.leadId, loanId: localLoanId },
        }
      );
    }

    return reconcileRemoteLoan(
      input,
      deps,
      lead,
      localRemote,
      localRemote,
      "already-linked"
    );
  }

  const allowCreate = input.allowCreate !== false;
  const rawSearch = await deps.searchLoansByExternalId(input.leadId);
  const candidates = normalizeSearchResults(rawSearch);

  if (candidates.length > 0) {
    // Fineract's endpoint is queried with externalId, but older deployments
    // have returned broad search results.  Treat every returned row as a
    // conflict unless it is the one exact external-ID row; silently ignoring a
    // broad result could create a duplicate.
    const exactCandidates = candidates.filter(
      (candidate) => getLoanExternalId(candidate) === input.leadId
    );

    if (exactCandidates.length !== 1 || candidates.length !== 1) {
      throw new LeadLoanLinkingError(
        "Fineract returned multiple or non-exact loans for this lead; no loan was linked",
        {
          status: 409,
          code: "LEAD_LOAN_EXTERNAL_ID_CONFLICT",
          details: {
            leadId: input.leadId,
            returnedLoans: candidates.map((candidate) => ({
              loanId: getLoanId(candidate),
              externalId: getLoanExternalId(candidate),
              clientId: getLoanClientId(candidate),
            })),
          },
        }
      );
    }

    return reconcileRemoteLoan(
      input,
      deps,
      lead,
      exactCandidates[0],
      exactCandidates[0],
      "linked"
    );
  }

  if (!allowCreate) {
    throw new LeadLoanLinkingError(
      "The Fineract CREATE webhook did not include an exact loan to link",
      {
        status: 409,
        code: "LEAD_LOAN_REMOTE_NOT_FOUND",
        details: { leadId: input.leadId },
      }
    );
  }

  const payload = {
    ...(input.fineractPayload || {}),
    clientId: expectedClientId,
    externalId: input.leadId,
  };

  let createdResponse: unknown;
  try {
    createdResponse = await deps.createLoan(payload);
  } catch (error) {
    // A request can reach Fineract and lose its response.  Reconcile once
    // before surfacing the error; this is what makes a retry safe after a
    // remote success.  Duplicate external-ID responses are handled the same
    // way, without issuing a second POST.
    try {
      const afterCreateSearch = normalizeSearchResults(
        await deps.searchLoansByExternalId(input.leadId)
      );
      if (afterCreateSearch.length > 0) {
        const exact = afterCreateSearch.filter(
          (candidate) => getLoanExternalId(candidate) === input.leadId
        );
        if (exact.length === 1 && afterCreateSearch.length === 1) {
          return reconcileRemoteLoan(
            input,
            deps,
            lead,
            exact[0],
            exact[0],
            "linked"
          );
        }
      }
    } catch {
      // Preserve the original Fineract error below.  A later client retry will
      // run the exact search again.
    }

    if (duplicateExternalIdError(error)) {
      throw new LeadLoanLinkingError(
        "Fineract already has a loan for this lead, but it could not be reconciled safely",
        {
          status: 409,
          code: "LEAD_LOAN_EXTERNAL_ID_CONFLICT",
          details: { leadId: input.leadId },
        }
      );
    }
    throw error;
  }

  const createdRecord =
    createdResponse && typeof createdResponse === "object"
      ? (createdResponse as FineractLoanRecord)
      : {};
  const createdLoanId = getLoanId(createdRecord);
  if (!createdLoanId) {
    // Some Fineract adapters return an empty command result while the loan is
    // committed.  Search before failing so the next retry remains safe.
    const afterCreateSearch = normalizeSearchResults(
      await deps.searchLoansByExternalId(input.leadId)
    );
    if (afterCreateSearch.length === 1) {
      return reconcileRemoteLoan(
        input,
        deps,
        lead,
        afterCreateSearch[0],
        createdResponse,
        "linked"
      );
    }
    throw new LeadLoanLinkingError(
      "Fineract created a response without a usable loan ID",
      {
        status: 502,
        code: "FINERACT_LOAN_ID_MISSING",
      }
    );
  }

  const createdClientId = getLoanClientId(createdRecord);
  if (createdClientId && createdClientId !== expectedClientId) {
    throw new LeadLoanLinkingError(
      "Fineract returned a loan for a different client; no local link was written",
      {
        status: 409,
        code: "LEAD_LOAN_CLIENT_CONFLICT",
        details: {
          expectedClientId,
          remoteClientId: createdClientId,
          remoteLoanId: createdLoanId,
        },
      }
    );
  }

  const createdLoan: FineractLoanRecord = {
    ...createdRecord,
    id: createdLoanId,
    clientId: expectedClientId,
    externalId: input.leadId,
  };

  const result = await reconcileRemoteLoan(
    input,
    deps,
    lead,
    createdLoan,
    createdResponse,
    "linked"
  );

  return {
    ...result,
    action: result.terminal ? "terminal" : "created",
  };
}

// Small aliases make the intended operation discoverable to callers that use
// the “create or reconcile” wording while retaining one implementation.
export const createOrReconcileLeadLoan = reconcileLeadLoan;
export const linkLeadLoan = reconcileLeadLoan;
