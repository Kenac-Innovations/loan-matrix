import { NextRequest, NextResponse } from "next/server";
import type { Agent } from "https";
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

async function parseFineractResponse(response: Response) {
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: loanId } = await params;
    const body = await request.json();

    const accessToken = await getUserAccessToken();
    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const fineractTenantId = await getFineractTenantId();
    const url = `${baseUrl}/fineract-provider/api/v1/loans/${loanId}/transactions?command=creditBalanceRefund`;

    const requestOptions: FineractRequestInit = {
      method: "POST",
      headers: {
        Authorization: `Basic ${accessToken}`,
        "Fineract-Platform-TenantId": fineractTenantId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    };

    if (url.startsWith("https://")) {
      const { Agent } = await import("https");
      requestOptions.agent = new Agent({ rejectUnauthorized: false });
    }

    const response = await fetch(url, requestOptions);

    const data = await parseFineractResponse(response);

    if (!response.ok) {
      return NextResponse.json(
        data || { error: `API error: ${response.status}` },
        {
          status: response.status,
        }
      );
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error("Error creating credit balance refund:", error);
    if (
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      "errorData" in error
    ) {
      const status = Number((error as { status: unknown }).status);
      const errorData = (error as { errorData: unknown }).errorData;

      if (Number.isInteger(status)) {
        return NextResponse.json(errorData, { status });
      }
    }

    const message = error instanceof Error ? error.message : undefined;
    return NextResponse.json(
      { error: message || "Failed to create credit balance refund" },
      { status: 500 }
    );
  }
}
