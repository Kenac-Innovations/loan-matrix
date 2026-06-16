import type { FineractClient } from "@/lib/fineract-api";

export type OfficeIdValue = string | number | null | undefined;

export interface ClientOfficeTransferService {
  getClient(clientId: number): Promise<FineractClient>;
  transferClientToOffice(
    clientId: number,
    destinationOfficeId: number
  ): Promise<unknown>;
}

export interface ExistingClientOfficeTransferResult {
  client: FineractClient;
  moved: boolean;
  fromOfficeId: number | null;
  toOfficeId: number | null;
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

export async function ensureExistingClientInCreatorOffice(input: {
  fineractService: ClientOfficeTransferService;
  client: FineractClient;
  creatorOfficeId: OfficeIdValue;
}) {
  const creatorOfficeId = normalizeOfficeId(input.creatorOfficeId);
  if (!creatorOfficeId) {
    throw new Error(
      "Logged-in user's branch is required before creating a lead for an existing client."
    );
  }

  const clientOfficeId = normalizeOfficeId(input.client.officeId);
  if (
    !shouldMoveExistingClientToCreatorOffice({
      clientOfficeId,
      creatorOfficeId,
    })
  ) {
    return {
      client: input.client,
      moved: false,
      fromOfficeId: clientOfficeId,
      toOfficeId: creatorOfficeId,
    } satisfies ExistingClientOfficeTransferResult;
  }

  await input.fineractService.transferClientToOffice(
    input.client.id,
    creatorOfficeId
  );

  const movedClient = await input.fineractService.getClient(input.client.id);

  return {
    client: movedClient,
    moved: true,
    fromOfficeId: clientOfficeId,
    toOfficeId: creatorOfficeId,
  } satisfies ExistingClientOfficeTransferResult;
}
