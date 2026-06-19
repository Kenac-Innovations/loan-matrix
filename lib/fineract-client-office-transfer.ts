import type { FineractClient } from "@/lib/fineract-api";

export type OfficeIdValue = string | number | null | undefined;

export interface ExistingClientOfficeTransferResult {
  client: FineractClient;
  moved: boolean;
  fromOfficeId: number | null;
  toOfficeId: number | null;
  leadOfficeId: number;
  leadOfficeName: string | null;
  clientBelongsToDifferentOffice: boolean;
}

export interface ExistingClientTransferRequirement {
  clientId: number;
  clientDisplayName: string;
  clientOfficeId: number | null;
  clientOfficeName: string | null;
  destinationOfficeId: number;
  destinationOfficeName: string | null;
}

export interface ExistingClientTransferUiState {
  badgeLabel: "Different Branch";
  officeHint: string;
}

export function normalizeOfficeId(value: OfficeIdValue) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export function shouldMoveExistingClientToCreatorOffice(input: {
  clientOfficeId: OfficeIdValue;
  creatorOfficeId: OfficeIdValue;
}) {
  const clientOfficeId = normalizeOfficeId(input.clientOfficeId);
  const creatorOfficeId = normalizeOfficeId(input.creatorOfficeId);

  return Boolean(
    clientOfficeId && creatorOfficeId && clientOfficeId !== creatorOfficeId
  );
}

export function ensureExistingClientInCreatorOffice(input: {
  client: FineractClient;
  creatorOfficeId: OfficeIdValue;
  creatorOfficeName?: string | null;
}) {
  const creatorOfficeId = normalizeOfficeId(input.creatorOfficeId);
  if (!creatorOfficeId) {
    throw new Error(
      "Logged-in user's branch is required before creating a lead for an existing client."
    );
  }

  const clientOfficeId = normalizeOfficeId(input.client.officeId);
  const clientBelongsToDifferentOffice = shouldMoveExistingClientToCreatorOffice(
    {
      clientOfficeId,
      creatorOfficeId,
    }
  );

  return {
    client: input.client,
    moved: false,
    fromOfficeId: clientOfficeId,
    toOfficeId: creatorOfficeId,
    leadOfficeId: creatorOfficeId,
    leadOfficeName: input.creatorOfficeName?.trim() || null,
    clientBelongsToDifferentOffice,
  } satisfies ExistingClientOfficeTransferResult;
}

export function getExistingClientTransferRequirement(input: {
  clientId: number;
  clientDisplayName: string;
  clientOfficeId: OfficeIdValue;
  clientOfficeName?: string | null;
  creatorOfficeId: OfficeIdValue;
  creatorOfficeName?: string | null;
}): ExistingClientTransferRequirement | null {
  const clientOfficeId = normalizeOfficeId(input.clientOfficeId);
  const creatorOfficeId = normalizeOfficeId(input.creatorOfficeId);

  if (
    !creatorOfficeId ||
    !shouldMoveExistingClientToCreatorOffice({
      clientOfficeId,
      creatorOfficeId,
    })
  ) {
    return null;
  }

  return {
    clientId: input.clientId,
    clientDisplayName: input.clientDisplayName,
    clientOfficeId,
    clientOfficeName: input.clientOfficeName?.trim() || null,
    destinationOfficeId: creatorOfficeId,
    destinationOfficeName: input.creatorOfficeName?.trim() || null,
  };
}

export function getExistingClientTransferUiState(input: {
  clientId: number;
  clientDisplayName: string;
  clientOfficeId: OfficeIdValue;
  clientOfficeName?: string | null;
  creatorOfficeId: OfficeIdValue;
  creatorOfficeName?: string | null;
}): ExistingClientTransferUiState | null {
  const transferRequirement = getExistingClientTransferRequirement(input);

  if (!transferRequirement) {
    return null;
  }

  return {
    badgeLabel: "Different Branch",
    officeHint: transferRequirement.destinationOfficeName
      ? `Needs transfer to ${transferRequirement.destinationOfficeName}`
      : "Needs transfer to your branch",
  };
}

export function getExistingClientTransferErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Failed to transfer the client to your branch. Please try again.";
}

export function assertExistingClientBranchTransferCompleted(
  transferState: ExistingClientOfficeTransferResult
) {
  if (!transferState.clientBelongsToDifferentOffice) {
    return transferState;
  }

  throw new Error(
    "Transfer this client to your branch before creating a lead."
  );
}
