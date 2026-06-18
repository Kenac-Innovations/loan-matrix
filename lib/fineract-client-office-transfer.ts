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
