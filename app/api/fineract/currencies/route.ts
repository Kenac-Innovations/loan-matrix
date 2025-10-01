// File: app/api/fineract/currencies/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getFineractServiceWithSession } from "@/lib/fineract-api";

export async function GET(request: NextRequest) {
  try {
    const fineractService = await getFineractServiceWithSession();
    const response = await fineractService.getCurrencies();

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("GET /api/fineract/currencies error:", error);

    // Better error handling for different error types
    const errorMessage =
      error?.message || error?.errorData?.defaultUserMessage || "Unknown error";
    const statusCode = error?.status || 500;

    return NextResponse.json(
      {
        error: errorMessage,
        details: error?.errorData || null,
      },
      { status: statusCode }
    );
  }
}
