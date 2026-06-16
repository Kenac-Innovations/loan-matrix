import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSession as getCustomSession } from "@/app/actions/auth";
import { getFineractTenantId } from "@/lib/fineract-tenant-service";

const FINERACT_BASE_URL =
  process.env.FINERACT_BASE_URL || "http://10.10.0.143:8443";

interface AccessTokenSession {
  base64EncodedAuthenticationKey?: string;
  accessToken?: string;
}

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

async function getAccessToken(): Promise<string | undefined> {
  try {
    const nextAuthSession = (await getSession()) as AccessTokenSession;
    if (nextAuthSession?.base64EncodedAuthenticationKey) {
      return nextAuthSession.base64EncodedAuthenticationKey;
    }
    if (nextAuthSession?.accessToken) {
      return nextAuthSession.accessToken;
    }

    const customSession = (await getCustomSession()) as AccessTokenSession;
    if (customSession?.base64EncodedAuthenticationKey) {
      return customSession.base64EncodedAuthenticationKey;
    }
    if (customSession?.accessToken) {
      return customSession.accessToken;
    }
  } catch (error) {
    console.error("Error resolving Fineract access token:", error);
  }

  return undefined;
}

function formatFineractDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Harare",
  }).format(date);
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
  accessToken,
  fineractTenantId,
  body,
}: {
  clientId: number;
  command: "proposeTransfer" | "acceptTransfer" | "withdrawTransfer";
  accessToken: string;
  fineractTenantId: string;
  body: Record<string, unknown>;
}) {
  return fetch(
    `${FINERACT_BASE_URL}/fineract-provider/api/v1/clients/${clientId}?command=${command}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${accessToken}`,
        "Fineract-Platform-TenantId": fineractTenantId,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    }
  );
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const clientId = Number.parseInt(id, 10);

  if (Number.isNaN(clientId)) {
    return NextResponse.json({ error: "Invalid client id" }, { status: 400 });
  }

  try {
    const payload = await request.json();
    const destinationOfficeId = Number(payload?.destinationOfficeId);

    if (!Number.isInteger(destinationOfficeId) || destinationOfficeId <= 0) {
      return NextResponse.json(
        { error: "A valid destination branch is required" },
        { status: 400 }
      );
    }

    const accessToken = await getAccessToken();
    if (!accessToken) {
      return NextResponse.json(
        { error: "No Fineract authentication token found" },
        { status: 401 }
      );
    }

    const fineractTenantId = await getFineractTenantId();
    const transferDate = formatFineractDate(new Date());
    const commonBody = {
      transferDate,
      dateFormat: "dd MMMM yyyy",
      locale: "en",
    };

    const proposeResponse = await postClientTransferCommand({
      clientId,
      command: "proposeTransfer",
      accessToken,
      fineractTenantId,
      body: {
        ...commonBody,
        destinationOfficeId,
        note: "Branch move proposed from Loan Matrix",
      },
    });

    if (!proposeResponse.ok) {
      const error = await parseFineractError(proposeResponse);
      return NextResponse.json(error, { status: proposeResponse.status });
    }

    const acceptResponse = await postClientTransferCommand({
      clientId,
      command: "acceptTransfer",
      accessToken,
      fineractTenantId,
      body: {
        ...commonBody,
        note: "Branch move accepted from Loan Matrix",
      },
    });

    if (!acceptResponse.ok) {
      const acceptError = await parseFineractError(acceptResponse);

      await postClientTransferCommand({
        clientId,
        command: "withdrawTransfer",
        accessToken,
        fineractTenantId,
        body: {
          ...commonBody,
          note: "Branch move withdrawn after accept transfer failed",
        },
      }).catch((rollbackError) => {
        console.error("Failed to rollback proposed client transfer:", rollbackError);
      });

      return NextResponse.json(acceptError, { status: acceptResponse.status });
    }

    const data = await acceptResponse.json().catch(() => ({}));
    return NextResponse.json(data);
  } catch (error) {
    console.error("POST /api/fineract/clients/[id]/transfer-office error:", error);
    return NextResponse.json(
      {
        error: "Failed to move client branch",
      },
      { status: 500 }
    );
  }
}
