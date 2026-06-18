import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getFineractTenantId } from "@/lib/fineract-tenant-service";
import { resolveClientBranchTransferTarget } from "@/lib/client-branch-transfer-policy";
import { getSearchHeaders } from "@/lib/fineract-search-auth";

const FINERACT_BASE_URL =
  process.env.FINERACT_BASE_URL || "http://10.10.0.143:8443";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

function formatFineractDate(date: Date) {
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

async function parseFineractError(response: Response) {
  const details = await response.json().catch(() => null);

  return {
    error:
      details?.defaultUserMessage ||
      details?.errors?.[0]?.defaultUserMessage ||
      `Fineract API error ${response.status}`,
    details,
  };
}

async function postClientTransferCommand({
  clientId,
  command,
  headers,
  body,
}: {
  clientId: number;
  command: "proposeTransfer" | "acceptTransfer" | "withdrawTransfer";
  headers: Record<string, string>;
  body: Record<string, unknown>;
}) {
  return fetch(
    `${FINERACT_BASE_URL}/fineract-provider/api/v1/clients/${clientId}?command=${command}`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    }
  );
}

async function fetchClientOffice({
  clientId,
  headers,
}: {
  clientId: number;
  headers: Record<string, string>;
}) {
  const response = await fetch(
    `${FINERACT_BASE_URL}/fineract-provider/api/v1/clients/${clientId}`,
    {
      method: "GET",
      headers,
      cache: "no-store",
    }
  );

  if (!response.ok) {
    return null;
  }

  const data = await response.json().catch(() => null);
  return {
    officeId:
      typeof data?.officeId === "number"
        ? data.officeId
        : Number(data?.officeId) || null,
    officeName:
      typeof data?.officeName === "string" ? data.officeName : null,
  };
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const clientId = Number.parseInt(id, 10);

  if (Number.isNaN(clientId)) {
    return NextResponse.json({ error: "Invalid client id" }, { status: 400 });
  }

  try {
    const payload = await request.json().catch(() => ({}));
    const session = await getSession();

    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    let transferTarget;
    try {
      transferTarget = resolveClientBranchTransferTarget({
        sessionOfficeId: session?.user?.officeId,
        sessionOfficeName: session?.user?.officeName,
        clientOfficeId: payload?.clientOfficeId,
        requestDestinationOfficeId: payload?.destinationOfficeId,
      });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "The logged-in user's branch is required before moving a client.",
        },
        { status: 400 }
      );
    }

    if (transferTarget.isCurrentBranch) {
      return NextResponse.json(
        { error: "This client is already assigned to your branch." },
        { status: 400 }
      );
    }

    const fineractTenantId = await getFineractTenantId();
    const fineractHeaders = getSearchHeaders(fineractTenantId);
    const transferDate = formatFineractDate(new Date());
    const actor = session?.user?.name || "Loan Matrix user";
    const commonBody = {
      transferDate,
      dateFormat: "dd MMMM yyyy",
      locale: "en",
    };
    const acceptBody = {
      note: `Branch move accepted from Loan Matrix by ${actor}`,
    };

    const proposeResponse = await postClientTransferCommand({
      clientId,
      command: "proposeTransfer",
      headers: fineractHeaders,
      body: {
        ...commonBody,
        destinationOfficeId: transferTarget.destinationOfficeId,
        note: `Branch move proposed from Loan Matrix by ${actor}`,
      },
    });

    if (!proposeResponse.ok) {
      const error = await parseFineractError(proposeResponse);
      return NextResponse.json(error, { status: proposeResponse.status });
    }

    let acceptResponse = await postClientTransferCommand({
      clientId,
      command: "acceptTransfer",
      headers: fineractHeaders,
      body: acceptBody,
    });

    if (!acceptResponse.ok) {
      const acceptError = await parseFineractError(acceptResponse);

      await postClientTransferCommand({
        clientId,
        command: "withdrawTransfer",
        headers: fineractHeaders,
        body: {
          ...commonBody,
          note: `Branch move withdrawn after accept transfer failed for ${actor}`,
        },
      }).catch((rollbackError) => {
        console.error(
          "Failed to rollback proposed client transfer:",
          rollbackError
        );
      });

      return NextResponse.json(acceptError, { status: acceptResponse.status });
    }

    let updatedClientOffice = await fetchClientOffice({
      clientId,
      headers: fineractHeaders,
    });

    if (updatedClientOffice?.officeId !== transferTarget.destinationOfficeId) {
      await wait(250);

      acceptResponse = await postClientTransferCommand({
        clientId,
        command: "acceptTransfer",
        headers: fineractHeaders,
        body: acceptBody,
      });

      if (!acceptResponse.ok) {
        const retryAcceptError = await parseFineractError(acceptResponse);
        return NextResponse.json(retryAcceptError, {
          status: acceptResponse.status,
        });
      }

      updatedClientOffice = await fetchClientOffice({
        clientId,
        headers: fineractHeaders,
      });
    }

    if (updatedClientOffice?.officeId !== transferTarget.destinationOfficeId) {
      return NextResponse.json(
        {
          error:
            "Client transfer was proposed and accepted, but the destination office was not updated.",
          details: {
            destinationOfficeId: transferTarget.destinationOfficeId,
            currentOfficeId: updatedClientOffice?.officeId ?? null,
            currentOfficeName: updatedClientOffice?.officeName ?? null,
          },
        },
        { status: 502 }
      );
    }

    const data = await acceptResponse.json().catch(() => ({}));
    return NextResponse.json(data);
  } catch (error) {
    console.error(
      "POST /api/fineract/clients/[id]/transfer-office error:",
      error
    );
    return NextResponse.json(
      {
        error: "Failed to move client branch",
      },
      { status: 500 }
    );
  }
}
