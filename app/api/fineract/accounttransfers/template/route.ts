import { NextRequest, NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fromAccountId = searchParams.get("fromAccountId");
    const fromAccountType = searchParams.get("fromAccountType") || "1";
    const toAccountType = searchParams.get("toAccountType") || "2";

    if (!fromAccountId) {
      return NextResponse.json(
        { error: "fromAccountId is required" },
        { status: 400 }
      );
    }

    const data = await fetchFineractAPI(
      `/accounttransfers/template?fromAccountId=${fromAccountId}&fromAccountType=${fromAccountType}&toAccountType=${toAccountType}`
    );

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching account transfer template:", error);
    if (error.status && error.errorData) {
      return NextResponse.json(error.errorData, { status: error.status });
    }
    return NextResponse.json(
      { error: error.message || "Failed to fetch account transfer template" },
      { status: 500 }
    );
  }
}
