// File: app/api/fineract/offices/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getFineractTenantId } from "@/lib/fineract-tenant-service";
import { getSearchHeaders } from "@/lib/fineract-search-auth";

const FINERACT_BASE_URL =
  process.env.FINERACT_BASE_URL || "http://10.10.0.143:8443";

interface FineractOffice {
  id?: number | string;
  name?: string;
}

interface FineractErrorPayload {
  defaultUserMessage?: string;
  errors?: Array<{ defaultUserMessage?: string }>;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}

function getErrorStatus(error: unknown) {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = Number((error as { status?: unknown }).status);
    return Number.isInteger(status) ? status : 500;
  }

  return 500;
}

function getErrorDetails(error: unknown) {
  if (typeof error === "object" && error !== null && "errorData" in error) {
    return (error as { errorData?: unknown }).errorData ?? null;
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderBy = searchParams.get("orderBy") || "id";
    const fineractTenantId = await getFineractTenantId();

    const response = await fetch(
      `${FINERACT_BASE_URL}/fineract-provider/api/v1/offices`,
      {
        method: "GET",
        headers: getSearchHeaders(fineractTenantId),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const details = (await response
        .json()
        .catch(() => null)) as FineractErrorPayload | null;
      return NextResponse.json(
        {
          error:
            details?.defaultUserMessage ||
            details?.errors?.[0]?.defaultUserMessage ||
            "Failed to fetch offices",
          details,
        },
        { status: response.status }
      );
    }

    const data = await response.json().catch(() => []);
    const offices: FineractOffice[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.pageItems)
        ? data.pageItems
        : [];
    const sortedOffices = Array.isArray(offices)
      ? [...offices].sort((a, b) => {
          if (orderBy === "name") {
            return String(a?.name || "").localeCompare(String(b?.name || ""));
          }

          return Number(a?.id || 0) - Number(b?.id || 0);
        })
      : [];

    return NextResponse.json(sortedOffices);
  } catch (error: unknown) {
    console.error("GET /api/fineract/offices error:", error);

    // Better error handling for different error types
    const errorDetails = getErrorDetails(error);
    const errorMessage = getErrorMessage(error);
    const statusCode = getErrorStatus(error);

    return NextResponse.json(
      {
        error: errorMessage,
        details: errorDetails,
      },
      { status: statusCode }
    );
  }
}
