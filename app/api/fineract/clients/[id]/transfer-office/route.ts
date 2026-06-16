import type { Agent } from "https";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSession as getCustomSession } from "@/app/actions/auth";
import { getFineractTenantId } from "@/lib/fineract-tenant-service";

const baseUrl = process.env.FINERACT_BASE_URL || "http://10.10.0.143:8443";

type AccessTokenSession = {
  base64EncodedAuthenticationKey?: string;
  accessToken?: string;
};

type FineractRequestInit = RequestInit & {
  agent?: Agent;
};

interface TransferOfficePayload {
  destinationOfficeId?: number;
}

async function getUserAccessToken(): Promise<string | undefined> {
  const nextAuthSession = (await getSession()) as AccessTokenSession | null;

  if (nextAuthSession?.base64EncodedAuthenticationKey) {
    return nextAuthSession.base64EncodedAuthenticationKey;
  }
  if (nextAuthSession?.accessToken) {
    return nextAuthSession.accessToken;
  }

  const customSession = (await getCustomSession()) as AccessTokenSession | null;
  if (customSession?.base64EncodedAuthenticationKey) {
    return customSession.base64EncodedAuthenticationKey;
  }
  if (customSession?.accessToken) {
    return customSession.accessToken;
  }

  return undefined;
}

function formatFineractDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Harare",
  }).format(date);
}

async function parseResponse(response: Response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return {
      defaultUserMessage: text,
      developerMessage: text,
    };
  }
}

async function fetchFromFineract(url: string, options: FineractRequestInit) {
  if (url.startsWith("https://")) {
    const { Agent } = await import("https");
    options.agent = new Agent({ rejectUnauthorized: false });
  }

  const response = await fetch(url, options);
  const data = await parseResponse(response);

  if (!response.ok) {
    const message =
      data?.defaultUserMessage ||
      data?.developerMessage ||
      `Fineract API error ${response.status}`;
    const error = new Error(message);
    Object.assign(error, { status: response.status, errorData: data });
    throw error;
  }

  return data;
}

function getErrorResponse(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    "errorData" in error
  ) {
    const status = Number((error as { status: unknown }).status);
    if (Number.isInteger(status)) {
      return NextResponse.json((error as { errorData: unknown }).errorData, {
        status,
      });
    }
  }

  return NextResponse.json(
    {
      error:
        error instanceof Error
          ? error.message
          : "Failed to transfer client branch",
    },
    { status: 500 }
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const clientId = Number(id);

  if (!Number.isInteger(clientId) || clientId <= 0) {
    return NextResponse.json({ error: "Invalid client ID" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as TransferOfficePayload;
    const destinationOfficeId = Number(body.destinationOfficeId);

    if (!Number.isInteger(destinationOfficeId) || destinationOfficeId <= 0) {
      return NextResponse.json(
        { error: "Destination branch is required" },
        { status: 400 }
      );
    }

    const accessToken = await getUserAccessToken();
    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const fineractTenantId = await getFineractTenantId();
    const transferDate = formatFineractDate();
    const headers = {
      Authorization: `Basic ${accessToken}`,
      "Fineract-Platform-TenantId": fineractTenantId,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    const baseClientUrl = `${baseUrl}/fineract-provider/api/v1/clients/${clientId}`;

    const proposedTransfer = await fetchFromFineract(
      `${baseClientUrl}?command=proposeTransfer`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          destinationOfficeId,
          transferDate,
          dateFormat: "dd MMMM yyyy",
          locale: "en",
          note: "Branch move from Loan Matrix",
        }),
      }
    );

    try {
      const acceptedTransfer = await fetchFromFineract(
        `${baseClientUrl}?command=acceptTransfer`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            transferDate,
            dateFormat: "dd MMMM yyyy",
            locale: "en",
            note: "Branch move accepted from Loan Matrix",
          }),
        }
      );

      return NextResponse.json({
        proposedTransfer,
        acceptedTransfer,
      });
    } catch (acceptError) {
      try {
        await fetchFromFineract(`${baseClientUrl}?command=withdrawTransfer`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            transferDate,
            dateFormat: "dd MMMM yyyy",
            locale: "en",
            note: "Branch move rolled back after accept failed",
          }),
        });
      } catch (withdrawError) {
        console.error("Failed to withdraw proposed client transfer:", withdrawError);
      }

      throw acceptError;
    }
  } catch (error) {
    console.error("Error transferring client branch:", error);
    return getErrorResponse(error);
  }
}
