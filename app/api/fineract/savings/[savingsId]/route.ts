import { NextRequest, NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ savingsId: string }> }
) {
  try {
    const { savingsId } = await context.params;
    const data = await fetchFineractAPI(
      `/savingsaccounts/${savingsId}?associations=all`
    );
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
