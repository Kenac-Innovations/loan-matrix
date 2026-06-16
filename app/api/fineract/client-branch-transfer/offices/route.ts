import type { Agent } from "https";
import { NextResponse } from "next/server";
import { getFineractTenantId } from "@/lib/fineract-tenant-service";
import { getSearchHeaders } from "@/lib/fineract-search-auth";

const baseUrl = process.env.FINERACT_BASE_URL || "http://10.10.0.143:8443";

type FineractRequestInit = RequestInit & {
  agent?: Agent;
};

interface FineractOffice {
  id: number;
  name: string;
}

async function fetchFromFineract(url: string, options: FineractRequestInit) {
  if (url.startsWith("https://")) {
    const { Agent } = await import("https");
    options.agent = new Agent({ rejectUnauthorized: false });
  }

  return fetch(url, options);
}

export async function GET() {
  try {
    const fineractTenantId = await getFineractTenantId();
    const url = `${baseUrl}/fineract-provider/api/v1/offices`;
    const response = await fetchFromFineract(url, {
      method: "GET",
      headers: getSearchHeaders(fineractTenantId),
      cache: "no-store",
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(errorData, { status: response.status });
    }

    const offices = await response.json();
    const normalizedOffices = Array.isArray(offices)
      ? offices
          .filter(
            (office: unknown): office is FineractOffice =>
              typeof office === "object" &&
              office !== null &&
              typeof (office as FineractOffice).id === "number" &&
              typeof (office as FineractOffice).name === "string"
          )
          .sort((a, b) => a.name.localeCompare(b.name))
      : [];

    return NextResponse.json(normalizedOffices);
  } catch (error) {
    console.error("Error fetching branch transfer offices:", error);
    return NextResponse.json(
      { error: "Failed to fetch branch list" },
      { status: 500 }
    );
  }
}
