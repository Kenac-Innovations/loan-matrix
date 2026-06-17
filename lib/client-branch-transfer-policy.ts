export type OfficeIdValue = string | number | null | undefined;

export interface ClientBranchTransferTargetInput {
  sessionOfficeId: OfficeIdValue;
  sessionOfficeName?: string | null;
  clientOfficeId: OfficeIdValue;
  requestDestinationOfficeId?: OfficeIdValue;
}

export interface ClientBranchTransferTarget {
  destinationOfficeId: number;
  destinationOfficeName: string | null;
  isCurrentBranch: boolean;
}

function normalizeOfficeId(value: OfficeIdValue) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function resolveClientBranchTransferTarget(
  input: ClientBranchTransferTargetInput
): ClientBranchTransferTarget {
  const destinationOfficeId = normalizeOfficeId(input.sessionOfficeId);

  if (!destinationOfficeId) {
    throw new Error(
      "The logged-in user's branch is required before moving a client."
    );
  }

  const clientOfficeId = normalizeOfficeId(input.clientOfficeId);

  return {
    destinationOfficeId,
    destinationOfficeName: input.sessionOfficeName?.trim() || null,
    isCurrentBranch: clientOfficeId === destinationOfficeId,
  };
}
