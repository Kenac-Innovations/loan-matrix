import { NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";

type LoanProductsResponse = {
  pageItems?: unknown[];
  data?: unknown[];
};

export async function GET() {
  try {
    const data = (await fetchFineractAPI("/loanproducts")) as
      | unknown[]
      | LoanProductsResponse;

    if (Array.isArray(data)) {
      return NextResponse.json(data);
    }

    if (Array.isArray(data?.pageItems)) {
      return NextResponse.json(data.pageItems);
    }

    if (Array.isArray(data?.data)) {
      return NextResponse.json(data.data);
    }

    return NextResponse.json([]);
  } catch (error: unknown) {
    console.error("Error fetching loan products:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch loan products";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
