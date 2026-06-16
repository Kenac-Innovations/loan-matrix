import { NextResponse } from "next/server";
import { getFineractTenantId } from "@/lib/fineract-tenant-service";
import { getSearchHeaders } from "@/lib/fineract-search-auth";

const FINERACT_BASE_URL =
  process.env.FINERACT_BASE_URL || "http://10.10.0.143:8443";

interface FineractOffice {
  id: number;
  name: string;
  externalId?: string;
}

export async function GET() {
  try {
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
      const details = await response.json().catch(() => null);
      return NextResponse.json(
        {
          error: "Failed to fetch branches",
          details,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    const offices = (Array.isArray(data) ? data : data?.pageItems || [])
      .filter((office: FineractOffice) => office?.id && office?.name)
      .sort((a: FineractOffice, b: FineractOffice) =>
        a.name.localeCompare(b.name)
      );

    return NextResponse.json(offices);
  } catch (error) {
    console.error(
      "GET /api/fineract/client-branch-transfer/offices error:",
      error
    );
    return NextResponse.json(
      {
        error: "Failed to fetch branches",
      },
      { status: 500 }
    );
  }
}
