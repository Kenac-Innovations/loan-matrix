import { getSearchHeaders } from "./fineract-search-auth";

function formatClientTransferDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Harare",
  }).formatToParts(date);

  const day = parts.find((part) => part.type === "day")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const year = parts.find((part) => part.type === "year")?.value;

  return `${day} ${month} ${year}`;
}

export function buildClientTransferCommandBody(args: {
  command: "proposeTransfer" | "acceptTransfer" | "rejectTransfer";
  destinationOfficeId?: number;
  note: string;
}) {
  if (args.command === "proposeTransfer") {
    return {
      destinationOfficeId: args.destinationOfficeId,
      transferDate: formatClientTransferDate(),
      dateFormat: "dd MMMM yyyy",
      locale: "en",
      note: args.note,
    };
  }

  return {
    note: args.note,
  };
}

async function parseTransferError(response: Response) {
  const details = await response.json().catch(() => null);

  return new Error(
    details?.defaultUserMessage ||
      details?.errors?.[0]?.defaultUserMessage ||
      details?.error ||
      `Fineract transfer API error ${response.status}`
  );
}

async function postTransferCommand(args: {
  baseUrl: string;
  tenantId: string;
  clientId: number;
  command:
    | "proposeTransfer"
    | "acceptTransfer"
    | "rejectTransfer"
    | "withdrawTransfer";
  body: Record<string, unknown>;
  fetchImpl?: typeof fetch;
}) {
  const fetcher = args.fetchImpl ?? fetch;

  return fetcher(
    `${args.baseUrl}/fineract-provider/api/v1/clients/${args.clientId}?command=${args.command}`,
    {
      method: "POST",
      headers: getSearchHeaders(args.tenantId),
      body: JSON.stringify(args.body),
      cache: "no-store",
    }
  );
}

export async function transferClientToOfficeWithServiceAuth(args: {
  baseUrl: string;
  tenantId: string;
  clientId: number;
  destinationOfficeId: number;
  fetchImpl?: typeof fetch;
}) {
  if (!Number.isInteger(args.clientId) || args.clientId <= 0) {
    throw new Error("A valid Fineract client ID is required");
  }

  if (
    !Number.isInteger(args.destinationOfficeId) ||
    args.destinationOfficeId <= 0
  ) {
    throw new Error("A valid destination office ID is required");
  }

  const proposeResponse = await postTransferCommand({
    baseUrl: args.baseUrl,
    tenantId: args.tenantId,
    clientId: args.clientId,
    command: "proposeTransfer",
    body: buildClientTransferCommandBody({
      command: "proposeTransfer",
      destinationOfficeId: args.destinationOfficeId,
      note: "Branch move proposed automatically during existing-client lead creation",
    }),
    fetchImpl: args.fetchImpl,
  });

  if (!proposeResponse.ok) {
    throw await parseTransferError(proposeResponse);
  }

  const acceptResponse = await postTransferCommand({
    baseUrl: args.baseUrl,
    tenantId: args.tenantId,
    clientId: args.clientId,
    command: "acceptTransfer",
    body: buildClientTransferCommandBody({
      command: "acceptTransfer",
      note: "Branch move accepted automatically during existing-client lead creation",
    }),
    fetchImpl: args.fetchImpl,
  });

  if (acceptResponse.ok) {
    return acceptResponse.json().catch(() => ({}));
  }

  await postTransferCommand({
    baseUrl: args.baseUrl,
    tenantId: args.tenantId,
    clientId: args.clientId,
    command: "rejectTransfer",
    body: buildClientTransferCommandBody({
      command: "rejectTransfer",
      note: "Branch move rejected after automatic accept transfer failed",
    }),
    fetchImpl: args.fetchImpl,
  }).catch((rollbackError) => {
    console.error(
      "Failed to rollback proposed client office transfer:",
      rollbackError
    );
  });

  throw await parseTransferError(acceptResponse);
}
