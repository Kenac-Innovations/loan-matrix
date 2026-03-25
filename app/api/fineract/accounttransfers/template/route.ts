import { NextRequest, NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";
import { getFineractErrorMessage } from "@/lib/fineract-error";

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
    const status = error.status || 500;
    return NextResponse.json(
      { error: getFineractErrorMessage(error) },
      { status }
    );
  }
}
